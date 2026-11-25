import java.io.File;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;
import java.util.UUID;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.Part;
import org.apache.commons.io.FilenameUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class Uploads {
  private static final Path DIR = Paths.get("/var/app/uploads");
  private static final Set<String> TYPES = Set.of("png", "jpg");

  @PostMapping("/avatar")
  public void avatar(@RequestParam MultipartFile file) throws Exception {
    // ruleid: java-upload-client-filename
    file.transferTo(new File("/var/app/uploads", file.getOriginalFilename()));
  }

  @PostMapping("/doc")
  public void doc(@RequestParam MultipartFile file) throws Exception {
    String name = StringUtils.cleanPath(file.getOriginalFilename());
    // ruleid: java-upload-client-filename
    Files.copy(file.getInputStream(), DIR.resolve(name));
  }

  void servlet(HttpServletRequest request) throws Exception {
    Part part = request.getPart("file");
    // ruleid: java-upload-client-filename
    try (FileOutputStream out = new FileOutputStream("/var/app/uploads/" + part.getSubmittedFileName())) {
      part.getInputStream().transferTo(out);
    }
  }

  @PostMapping("/varpath")
  public void varPath(@RequestParam MultipartFile file) throws Exception {
    var dir = new File("/var/app/uploads").toPath();
    // ruleid: java-upload-client-filename
    Files.copy(file.getInputStream(), dir.resolve(file.getOriginalFilename()));
  }

  // --- safe ------------------------------------------------------------------------------------

  @PostMapping("/avatar-safe")
  public void avatarSafe(@RequestParam MultipartFile file) throws Exception {
    String ext = FilenameUtils.getExtension(file.getOriginalFilename()).toLowerCase();
    if (!TYPES.contains(ext)) throw new IllegalArgumentException("type");
    // ok: java-upload-client-filename
    file.transferTo(DIR.resolve(UUID.randomUUID() + "." + ext));
  }

  @PostMapping("/doc-safe")
  public void docSafe(@RequestParam MultipartFile file) throws Exception {
    // ok: java-upload-client-filename
    Files.copy(file.getInputStream(), DIR.resolve(FilenameUtils.getName(file.getOriginalFilename())));
  }

  @PostMapping("/zip")
  public void zip(@RequestParam MultipartFile file) throws Exception {
    java.util.zip.ZipFile zip = new java.util.zip.ZipFile(DIR.resolve(UUID.randomUUID().toString()).toFile());
    java.util.zip.ZipEntry e = zip.entries().nextElement();
    // ok: java-upload-client-filename
    new File("/var/app/unzipped", e.getName()).createNewFile();
    // ok: java-upload-client-filename
    org.slf4j.LoggerFactory.getLogger(Uploads.class).debug("saved {}", new File(DIR.toFile(), file.getOriginalFilename()));
  }

  @PostMapping("/meta")
  public String meta(@RequestParam MultipartFile file) {
    // ok: java-upload-client-filename
    return "received " + file.getOriginalFilename();
  }
}
