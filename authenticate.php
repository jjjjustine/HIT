<?php
session_start();
$conn = new mysqli("localhost", "root", "", "esp32_system");

$username = $_POST['username'];
$password = $_POST['password'];

$result = $conn->query(
  "SELECT * FROM users WHERE username='$username' AND password='$password'"
);

if ($result->num_rows == 1) {
  $_SESSION['user'] = $username;
  header("Location: dashboard.php");
} else {
  echo "Invalid username or password";
}
?>
