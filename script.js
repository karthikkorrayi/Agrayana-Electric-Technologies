// Application state
let database = [];
let currentImage = null;

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const uploadedImage = document.getElementById('uploadedImage');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const discardBtn = document.getElementById('discardBtn');
const extractBtn = document.getElementById('extractBtn');
const extractText = document.getElementById('extractText');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const databaseStatus = document.getElementById('databaseStatus');
const alertContainer = document.getElementById('alertContainer');
const progressText = document.getElementById('progressText');
const rawTextContainer = document.getElementById('rawTextContainer');
const rawText = document.getElementById('rawText');

// Form inputs
const nameInput = document.getElementById('nameInput');
const businessInput = document.getElementById('businessInput');
const addressInput = document.getElementById('addressInput');
const contactInput = document.getElementById('contactInput');
const productInput = document.getElementById('productInput');

// Initialize event listeners
function initializeEventListeners() {
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('drop', handleDrop);
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileInputChange);
    uploadBtn.addEventListener('click', () => fileInput.click());
    discardBtn.addEventListener('click', handleDiscard);
    extractBtn.addEventListener('click', handleExtract);
    saveBtn.addEventListener('click', handleSave);
    clearBtn.addEventListener('click', handleClear);
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
}

// Drag and drop handlers
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileUpload(files[0]);
    }
}

function handleFileInputChange(e) {
    const file = e.target.files[0];
    if (file) {
        handleFileUpload(file);
    }
}

function handleFileUpload(file) {
    if (file.type !== 'image/jpeg') {
        showAlert('Only JPEG files are allowed!', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        currentImage = e.target.result;
        uploadedImage.src = currentImage;
        uploadedImage.classList.remove('hidden');
        uploadPlaceholder.classList.add('hidden');
        extractBtn.disabled = false;
        rawTextContainer.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

function handleDiscard() {
    currentImage = null;
    uploadedImage.classList.add('hidden');
    uploadPlaceholder.classList.remove('hidden');
    extractBtn.disabled = true;
    rawTextContainer.classList.add('hidden');
    clearForm();
}

// Real OCR extraction using Tesseract.js
async function handleExtract() {
    if (!currentImage) {
        showAlert('Please upload an image first!', 'error');
        return;
    }

    try {
        // Perform OCR
        const result = await Tesseract.recognize(
            currentImage,
            'eng',
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        Math.round(m.progress * 100);
                    }
                }
            }
        );

        const extractedText = result.data.text;
        
        // Show raw OCR text
        rawText.textContent = extractedText;
        rawTextContainer.classList.remove('hidden');

        // Parse the extracted text into fields
        const parsedData = parseVisitingCardText(extractedText);
        
        // Populate form fields
        nameInput.value = parsedData.name;
        businessInput.value = parsedData.business;
        addressInput.value = parsedData.address;
        contactInput.value = parsedData.contactNo;
        productInput.value = parsedData.productService;

        showAlert('Text extracted and parsed successfully!', 'success');
    } catch (error) {
        console.error('OCR Error:', error);
        showAlert('Error during text extraction. Please try again.', 'error');
    } finally {
        // Reset button state
        extractBtn.disabled = false;
        extractText.textContent = 'EXTRACT';
        extractSpinner.classList.add('hidden');
    }
}

// Parse extracted text into structured data
function parseVisitingCardText(text) {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const parsedData = {
        name: '',
        business: '',
        address: '',
        contactNo: '',
        productService: ''
    };

    // Patterns for different field types
    const patterns = {
        phone: /(\+?[\d\s\-\(\)]{7,})/g,
        email: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
        website: /(www\.|https?:\/\/)[^\s]+/g,
        address: /(\d+.*(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|way|place|pl|court|ct|circle|cir|boulevard|blvd).*)/i
    };

    let usedLines = new Set();
    
    // Extract phone numbers
    const phoneMatches = text.match(patterns.phone);
    if (phoneMatches) {
        parsedData.contactNo = phoneMatches[0].trim();
        // Mark lines with phone numbers as used
        lines.forEach((line, index) => {
            if (line.includes(parsedData.contactNo)) {
                usedLines.add(index);
            }
        });
    }

    // Extract address
    const addressMatches = text.match(patterns.address);
    if (addressMatches) {
        parsedData.address = addressMatches[0].trim();
        lines.forEach((line, index) => {
            if (line.toLowerCase().includes(parsedData.address.toLowerCase())) {
                usedLines.add(index);
            }
        });
    }

    // Find name (usually first line or line with title patterns)
    const titlePatterns = /(mr|ms|mrs|dr|prof|ceo|cto|manager|director|president|founder)/i;
    for (let i = 0; i < lines.length; i++) {
        if (!usedLines.has(i)) {
            const line = lines[i].trim();
            if (line.length > 2 && line.length < 50) {
                // Check if it looks like a name
                const words = line.split(/\s+/);
                if (words.length >= 1 && words.length <= 4) {
                    const hasNumbers = /\d/.test(line);
                    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(line);
                    
                    if (!hasNumbers && !hasSpecialChars) {
                        parsedData.name = line;
                        usedLines.add(i);
                        break;
                    }
                }
            }
        }
    }

    // Find business/company name
    const businessKeywords = /\b(inc|ltd|llc|corp|corporation|company|co|pvt|private|limited|solutions|services|technologies|tech|group|enterprises|consulting|consultancy)\b/i;
    for (let i = 0; i < lines.length; i++) {
        if (!usedLines.has(i)) {
            const line = lines[i].trim();
            if (businessKeywords.test(line) || (line.length > 3 && line.length < 100)) {
                parsedData.business = line;
                usedLines.add(i);
                break;
            }
        }
    }

    // Remaining lines could be product/service description
    const remainingLines = lines.filter((line, index) => !usedLines.has(index));
    if (remainingLines.length > 0) {
        // Look for lines that might describe products/services
        const serviceKeywords = /\b(service|product|solution|software|hardware|development|design|consulting|marketing|sales|support|training|maintenance|repair|installation)\b/i;
        for (const line of remainingLines) {
            if (serviceKeywords.test(line)) {
                parsedData.productService = line.trim();
                break;
            }
        }
        
        // If no service keywords found, use the first remaining line
        if (!parsedData.productService && remainingLines[0]) {
            parsedData.productService = remainingLines[0].trim();
        }
    }

    // Clean up extracted data
    Object.keys(parsedData).forEach(key => {
        if (parsedData[key]) {
            parsedData[key] = parsedData[key].replace(/\s+/g, ' ').trim();
        }
    });

    return parsedData;
}

function handleSave() {
    if (!nameInput.value.trim()) {
        showAlert('Please enter at least a name before saving!', 'error');
        return;
    }

    const newEntry = {
        id: Date.now(),
        name: nameInput.value,
        business: businessInput.value,
        address: addressInput.value,
        contactNo: contactInput.value,
        productService: productInput.value,
        timestamp: new Date().toISOString()
    };

    database.push(newEntry);
    updateDatabaseStatus();
    clearAll();
    showAlert('Data saved successfully!', 'success');
}

function handleClear() {
    clearAll();
}

function clearForm() {
    nameInput.value = '';
    businessInput.value = '';
    addressInput.value = '';
    contactInput.value = '';
    productInput.value = '';
}

function clearAll() {
    clearForm();
    currentImage = null;
    uploadedImage.classList.add('hidden');
    uploadPlaceholder.classList.remove('hidden');
    extractBtn.disabled = true;
    searchInput.value = '';
    searchResults.classList.add('hidden');
    rawTextContainer.classList.add('hidden');
}

function handleSearch() {
    const searchTerm = searchInput.value.trim();
    
    if (!searchTerm) {
        searchResults.classList.add('hidden');
        return;
    }

    const results = database.filter(entry =>
        Object.values(entry).some(value =>
            value.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    displaySearchResults(results);
}

function displaySearchResults(results) {
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
        searchResults.classList.remove('hidden');
        return;
    }

    const resultsHtml = results.map(result => `
        <div class="search-result-item" onclick="selectSearchResult(${result.id})">
            <div class="search-result-name">${result.name}</div>
            <div class="search-result-business">${result.business}</div>
        </div>
    `).join('');

    searchResults.innerHTML = resultsHtml;
    searchResults.classList.remove('hidden');
}

function selectSearchResult(id) {
    const entry = database.find(item => item.id === id);
    if (entry) {
        nameInput.value = entry.name;
        businessInput.value = entry.business;
        addressInput.value = entry.address;
        contactInput.value = entry.contactNo;
        productInput.value = entry.productService;
        
        searchResults.classList.add('hidden');
        searchInput.value = '';
    }
}

function updateDatabaseStatus() {
    const totalEntries = database.length;
    let statusText = `Total entries: ${totalEntries}`;
    
    if (totalEntries > 0) {
        const latest = database[totalEntries - 1];
        const latestDate = new Date(latest.timestamp).toLocaleString();
        statusText += `<br>Latest entry: ${latest.name} (${latestDate})`;
    }
    
    databaseStatus.innerHTML = statusText;
}

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    alertContainer.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Initialize the application
initializeEventListeners();
updateDatabaseStatus();