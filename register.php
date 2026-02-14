<?php
$conn = new mysqli("localhost", "root", "", "esp32_system");

$username = $_POST['username'];
$password = $_POST['password'];

$sql = "INSERT INTO users (username, password)
        VALUES ('$username', '$password')";

if ($conn->query($sql)) {
  header("Location: login.php");
} else {
  echo "Username already exists";
}
?>
