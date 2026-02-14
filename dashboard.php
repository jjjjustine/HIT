<?php
session_start();
if (!isset($_SESSION['user'])) {
    header("Location: login.php");
    exit();
}

$conn = new mysqli("localhost", "root", "", "esp32_system");
if ($conn->connect_error) die("Connection failed: " . $conn->connect_error);

$result = $conn->query("SELECT * FROM dht_data ORDER BY id DESC LIMIT 10");

$temps = [];
$hums = [];
$times = [];

while ($row = $result->fetch_assoc()) {
    $temps[] = $row['temperature'];
    $hums[] = $row['humidity'];
    $times[] = $row['created_at'];
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>Dashboard</title>
    <!-- Chart.js CDN -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>

<h2>Welcome, <?php echo $_SESSION['user']; ?></h2>

<h3>Temperature (°C)</h3>
<canvas id="tempChart" width="400" height="200"></canvas>

<h3>Humidity (%)</h3>
<canvas id="humChart" width="400" height="200"></canvas>

<!-- Hidden divs to pass PHP data to JS -->
<div id="labels" style="display:none;"><?php echo json_encode(array_reverse($times)); ?></div>
<div id="tempData" style="display:none;"><?php echo json_encode(array_reverse($temps)); ?></div>
<div id="humData" style="display:none;"><?php echo json_encode(array_reverse($hums)); ?></div>

<br>
<a href="logout.php">Logout</a>

<!-- Link to external JS -->
<script src="dashboard.js"></script>

</body>
</html>
