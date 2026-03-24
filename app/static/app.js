const API_URL = ""; // Current host
let token = localStorage.getItem("math_token");
let isSignup = false;

// DOM Elements
const authSection = document.getElementById("auth-section");
const dashboardSection = document.getElementById("dashboard-section");
const pdfPickerSection = document.getElementById("pdf-picker-section");
const solutionSection = document.getElementById("solution-section");

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const authSubmit = document.getElementById("auth-submit");
const authTitle = document.getElementById("auth-title");
const authToggle = document.getElementById("auth-toggle");
const authToggleText = document.getElementById("auth-toggle-text");
const logoutBtn = document.getElementById("logout-btn");

const fileUpload = document.getElementById("file-upload");
const uploadStatus = document.getElementById("upload-status");
const pdfPagesGrid = document.getElementById("pdf-pages-grid");
const historyList = document.getElementById("history-list");

const solutionImage = document.getElementById("solution-image");
const solutionContent = document.getElementById("solution-content");
const backToDashboard = document.getElementById("back-to-dashboard");
const copySolutionBtn = document.getElementById("copy-solution");
const shareLinkBtn = document.getElementById("share-link");

let currentSolutionShareToken = "";

// Initialize
function init() {
    if (token) {
        showDashboard();
    } else {
        showAuth();
    }
}

// Check if visiting a shared link
const urlParams = new URLSearchParams(window.location.search);
const sharedToken = urlParams.get('share');
if (sharedToken) {
    if (token) {
        viewSharedSolution(sharedToken);
    } else {
        // User must login first
        localStorage.setItem("pending_share", sharedToken);
    }
}

// Authentication
authToggle.addEventListener("click", (e) => {
    e.preventDefault();
    isSignup = !isSignup;
    authTitle.innerText = isSignup ? "Sign Up" : "Login";
    authSubmit.innerText = isSignup ? "Create Account" : "Login";
    authToggleText.innerText = isSignup ? "Already have an account?" : "Don't have an account?";
    authToggle.innerText = isSignup ? "Login" : "Sign Up";
});

authSubmit.addEventListener("click", async () => {
    const username = usernameInput.value;
    const password = passwordInput.value;

    if (isSignup) {
        const res = await fetch(`/signup?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, { method: "POST" });
        if (res.ok) {
            alert("Signup successful! Please login.");
            showAuth();
        } else {
            alert("Signup failed.");
        }
    } else {
        const formData = new FormData();
        formData.append("username", username);
        formData.append("password", password);

        const res = await fetch(`/token`, { method: "POST", body: formData });
        if (res.ok) {
            const data = await res.json();
            token = data.access_token;
            localStorage.setItem("math_token", token);

            const pendingShare = localStorage.getItem("pending_share");
            if (pendingShare) {
                localStorage.removeItem("pending_share");
                window.location.href = `/?share=${pendingShare}`;
            } else {
                showDashboard();
            }
        } else {
            alert("Login failed.");
        }
    }
});

logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("math_token");
    token = null;
    showAuth();
});

// Navigation
function showAuth() {
    isSignup = false;
    authTitle.innerText = "Login";
    authSubmit.innerText = "Login";
    authToggleText.innerText = "Don't have an account?";
    authToggle.innerText = "Sign Up";
    authSection.classList.remove("hidden");
    dashboardSection.classList.add("hidden");
    pdfPickerSection.classList.add("hidden");
    solutionSection.classList.add("hidden");
    logoutBtn.classList.add("hidden");
}

async function showDashboard() {
    authSection.classList.add("hidden");
    dashboardSection.classList.remove("hidden");
    pdfPickerSection.classList.add("hidden");
    solutionSection.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    loadHistory();
}

// File Upload
fileUpload.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    uploadStatus.innerText = "Uploading...";
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/upload", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
    });

    if (res.ok) {
        const data = await res.json();
        if (data.type === "pdf") {
            showPdfPicker(data.pages);
        } else {
            solveProblem(data.file_path);
        }
    } else {
        uploadStatus.innerText = "Upload failed.";
    }
});

function showPdfPicker(pages) {
    dashboardSection.classList.add("hidden");
    pdfPickerSection.classList.remove("hidden");
    pdfPagesGrid.innerHTML = "";

    pages.forEach(pagePath => {
        const div = document.createElement("div");
        div.className = "cursor-pointer border-2 border-transparent hover:border-blue-500 rounded p-1 transition";
        div.innerHTML = `<img src="/uploads/${pagePath}" class="w-full rounded shadow-sm">`;
        div.addEventListener("click", () => {
            solveProblem(pagePath);
        });
        pdfPagesGrid.appendChild(div);
    });
}

document.getElementById("cancel-pdf").addEventListener("click", showDashboard);

async function solveProblem(filePath) {
    pdfPickerSection.classList.add("hidden");
    dashboardSection.classList.add("hidden");
    solutionSection.classList.remove("hidden");
    solutionContent.innerHTML = "<p class='animate-pulse text-blue-600 font-semibold text-center py-10'>Solving problem, please wait...</p>";
    solutionImage.src = `/uploads/${filePath}`;

    const res = await fetch(`/solve?file_path=${encodeURIComponent(filePath)}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
    });

    if (res.ok) {
        const data = await res.json();
        renderSolution(data.solution, data.share_token);
    } else {
        solutionContent.innerHTML = "<p class='text-red-500 text-center py-10'>Failed to solve problem. Make sure the API key is correct.</p>";
    }
}

function renderSolution(markdown, shareToken) {
    solutionContent.innerHTML = marked.parse(markdown);
    currentSolutionShareToken = shareToken;
}

async function viewSharedSolution(shareToken) {
    authSection.classList.add("hidden");
    solutionSection.classList.remove("hidden");
    solutionContent.innerHTML = "Loading shared solution...";

    const res = await fetch(`/solution/view/${shareToken}`, {
        headers: { "Authorization": `Bearer ${token}` }
    });

    if (res.ok) {
        const data = await res.json();
        solutionImage.src = data.image_url;
        renderSolution(data.solution, shareToken);
    } else {
        solutionContent.innerHTML = "Solution not found or you don't have access.";
    }
}

async function loadHistory() {
    const res = await fetch("/history", {
        headers: { "Authorization": `Bearer ${token}` }
    });
    if (res.ok) {
        const data = await res.json();
        historyList.innerHTML = data.length === 0 ? "<p class='text-sm text-gray-500 italic text-center py-4'>No problems solved yet.</p>" : "";
        data.reverse().forEach(item => {
            const div = document.createElement("div");
            div.className = "flex items-center space-x-4 p-2 hover:bg-gray-50 rounded border cursor-pointer";
            div.innerHTML = `
                <img src="/uploads/${item.image_path}" class="w-12 h-12 object-cover rounded border">
                <div class="flex-grow">
                    <p class="text-xs text-gray-400">${new Date(item.created_at).toLocaleDateString()}</p>
                    <p class="text-sm font-medium text-gray-700 truncate w-48">${item.solution.substring(0, 50)}...</p>
                </div>
            `;
            div.addEventListener("click", () => {
                solutionImage.src = `/uploads/${item.image_path}`;
                solutionSection.classList.remove("hidden");
                dashboardSection.classList.add("hidden");
                renderSolution(item.solution, item.share_token);
            });
            historyList.appendChild(div);
        });
    }
}

backToDashboard.addEventListener("click", showDashboard);

copySolutionBtn.addEventListener("click", () => {
    const text = solutionContent.innerText;
    navigator.clipboard.writeText(text);
    alert("Solution copied to clipboard!");
});

shareLinkBtn.addEventListener("click", () => {
    const shareUrl = `${window.location.origin}/?share=${currentSolutionShareToken}`;
    navigator.clipboard.writeText(shareUrl);
    alert("Shareable link copied to clipboard! Send it to your friend (they will need to login to see it).");
});

init();
