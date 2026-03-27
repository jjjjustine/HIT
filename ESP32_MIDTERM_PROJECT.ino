#include <WiFi.h>
#include <HTTPClient.h>
#include "DHT.h"

// -------------------------
// Replace these with your info
// -------------------------
const char* ssid = "AYAW CONNECT, MA HACK KA!";
const char* password = "CAT1NG4N02060820";
const char* supabaseUrl = "https://qzmsxpuefsfkiebcocmq.supabase.co/rest/v1/readings";
const char* apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bXN4cHVlZnNma2llYmNvY21xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI0NTAsImV4cCI6MjA4OTQwODQ1MH0.qwU_C-rVhPusL88r50rixugIi5ljppYFdg8xehv75CQ";

// -------------------------
// DHT11 setup
// -------------------------
#define DHTPIN 4      // Data pin
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  dht.begin();

  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi!");
}

void loop() {
  // Read temperature & humidity
  float temp = dht.readTemperature(); // Celsius
  float hum = dht.readHumidity();

  // Check for failed readings
  if (isnan(temp) || isnan(hum)) {
    Serial.println("Failed to read from DHT sensor!");
    delay(2000);
    return;
  }

  // Only send if WiFi is connected
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(supabaseUrl); // Supabase table REST endpoint
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", apiKey);
    http.addHeader("Authorization", "Bearer " + String(apiKey));
    http.addHeader("Prefer", "return=minimal");

    // JSON body to insert
    String json = "{\"temperature\": " + String(temp) + ", \"humidity\": " + String(hum) + "}";

    int httpResponseCode = http.POST(json);

    Serial.println("JSON: " + json);
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);

    if (httpResponseCode > 0) {
      Serial.print("Data sent successfully! Response code: ");
      Serial.println(httpResponseCode);
    } else {
      Serial.print("Error sending data: ");
      Serial.println(httpResponseCode);
    }

    http.end();
  }

  delay(5000); // Wait 5 seconds before next reading
}