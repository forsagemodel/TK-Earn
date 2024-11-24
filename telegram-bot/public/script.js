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

async function activateAccount(userId) {
    const response = await fetch('/api/activate-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
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

    if (userStatus.active) {
        // If account is active, show referral details
        document.getElementById('status').textContent = 'Your account is active!';
        document.getElementById('referralCode').textContent = userStatus.referralCode;
        document.getElementById('dummyBalance').textContent = `$${userStatus.dummyBalance.toFixed(2)}`;
        const referralHistoryList = document.getElementById('referralHistory');

        if (userStatus.referralHistory.length > 0) {
            userStatus.referralHistory.forEach((referralId) => {
                const listItem = document.createElement('li');
                listItem.textContent = `User ID: ${referralId}`;
                referralHistoryList.appendChild(listItem);
            });
        } else {
            referralHistoryList.innerHTML = '<li>No referrals yet.</li>';
        }

        document.getElementById('user-info').style.display = 'block';
    } else {
        // If account is inactive, show activation options
        document.getElementById('status').textContent = 'Your account is inactive.';
        document.getElementById('referral-section').style.display = 'block';

        document.getElementById('referral-form').onsubmit = async (e) => {
            e.preventDefault();
            const referralCode = document.getElementById('referralCode').value;
            const result = await submitReferral(userId, referralCode);
            alert(result.message);
            if (result.success) window.location.reload();
        };

        document.getElementById('payment-section').style.display = 'block';

        document.getElementById('payment-button').onclick = async () => {
            const result = await activateAccount(userId);
            alert(result.message);
            if (result.success) window.location.reload();
        };
    }
}

init();
