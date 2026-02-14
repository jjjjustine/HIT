<?php
$conn = new mysqli("localhost", "root", "", "esp32_system");

if ($conn->connect_error) {
  die("Database connection failed");
}

$temp = $_GET['temperature'] ?? null;
$hum  = $_GET['humidity'] ?? null;

if ($temp !== null && $hum !== null) {
  $sql = "INSERT INTO dht_data (temperature, humidity)
          VALUES ('$temp', '$hum')";
  $conn->query($sql);
  echo "Data inserted successfully";
} else {
  echo "Missing parameters";
}
?>
