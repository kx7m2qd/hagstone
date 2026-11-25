package com.example.shop;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.springframework.stereotype.Service;

@Service
public class WebhookClient {
  private final HttpClient http = HttpClient.newHttpClient();

  public int ping(String callbackUrl) {
    try {
      // expect: java-ssrf
      HttpRequest req = HttpRequest.newBuilder(URI.create(callbackUrl))
          .POST(HttpRequest.BodyPublishers.ofString("{\"event\":\"ping\"}"))
          .build();
      return http.send(req, HttpResponse.BodyHandlers.discarding()).statusCode();
    } catch (Exception e) {
      return -1;
    }
  }
}
