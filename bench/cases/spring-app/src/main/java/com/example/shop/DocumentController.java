package com.example.shop;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.Principal;
import java.util.UUID;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {
  private static final Path STORE = Paths.get("/srv/shop/documents");
  private final DocumentRepository documents;

  public DocumentController(DocumentRepository documents) throws Exception {
    this.documents = documents;
    // expect: java-world-writable-permissions
    Files.setPosixFilePermissions(STORE, PosixFilePermissions.fromString("rwxrwxrwx"));
  }

  @PostMapping
  public void upload(@RequestParam MultipartFile file) throws Exception {
    // expect: java-upload-client-filename, java-path-traversal
    file.transferTo(new File(STORE.toFile(), file.getOriginalFilename()));
  }

  @PostMapping("/v2")
  public String uploadV2(@RequestParam MultipartFile file) throws Exception {
    String ext = FilenameUtils.getExtension(file.getOriginalFilename());
    String name = UUID.randomUUID() + "." + ext;
    file.transferTo(STORE.resolve(name));
    return name;
  }

  @GetMapping("/{id}")
  public Document get(@PathVariable Long id, Principal principal) {
    // expect: java-idor-unscoped-lookup
    return documents.findById(id).orElseThrow();
  }

  @GetMapping("/mine/{id}")
  public Document mine(@PathVariable Long id, Principal principal) {
    return documents.findByIdAndOwner(id, principal.getName()).orElseThrow();
  }

  @DeleteMapping("/{id}")
  public void delete(@PathVariable Long id, @RequestHeader("X-User-Role") String role) {
    // expect: java-client-controlled-authorization
    if (!"admin".equals(role)) throw new SecurityException("forbidden");
    documents.deleteById(id);
  }

  @ExceptionHandler(IllegalStateException.class)
  public ResponseEntity<String> failed(IllegalStateException e) {
    // expect: java-stack-trace-exposure
    return ResponseEntity.status(500).body(ExceptionUtils.getStackTrace(e));
  }

  @ExceptionHandler(RuntimeException.class)
  public ResponseEntity<String> failedSafe(RuntimeException e) {
    org.slf4j.LoggerFactory.getLogger(DocumentController.class).error("request failed", e);
    return ResponseEntity.status(500).body("Internal error");
  }
}
