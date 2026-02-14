// Reverse arrays so oldest data is first
const labels = JSON.parse(document.getElementById('labels').textContent);
const tempData = JSON.parse(document.getElementById('tempData').textContent);
const humData = JSON.parse(document.getElementById('humData').textContent);

// Temperature Chart
new Chart(document.getElementById('tempChart'), {
    type: 'line',
    data: {
        labels: labels,
        datasets: [{
            label: 'Temperature (°C)',
            data: tempData,
            borderColor: 'red',
            backgroundColor: 'rgba(255,0,0,0.1)',
            borderWidth: 2
        }]
    },
    options: {
        responsive: true,
        scales: { y: { beginAtZero: true } }
    }
});

// Humidity Chart
new Chart(document.getElementById('humChart'), {
    type: 'line',
    data: {
        labels: labels,
        datasets: [{
            label: 'Humidity (%)',
            data: humData,
            borderColor: 'blue',
            backgroundColor: 'rgba(0,0,255,0.1)',
            borderWidth: 2
        }]
    },
    options: {
        responsive: true,
        scales: { y: { beginAtZero: true } }
    }
});
