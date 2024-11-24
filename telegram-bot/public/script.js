async function fetchUserStatus(userId) {
    const response = await fetch(`/api/user-status?userId=${userId}`);
    return response.json();
}

async function submitReferral(userId, referralCode) {
    const response = await fetch('/api/submit-referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, referralCode }),
    });
    return response.json();
}

async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');
    if (!userId) {
        document.body.innerHTML = `<p>Error: Missing userId</p>`;
        return;
    }

    const userStatus = await fetchUserStatus(userId);
    document.getElementById('status').textContent = userStatus.active
        ? 'Your account is active!'
        : 'Your account is inactive.';

    if (!userStatus.active) {
        document.getElementById('referral-section').style.display = 'block';
        document.getElementById('referral-form').onsubmit = async (e) => {
            e.preventDefault();
            const referralCode = document.getElementById('referralCode').value;
            const result = await submitReferral(userId, referralCode);
            alert(result.message);
            if (result.success) window.location.reload();
        };
    }
}

init();
