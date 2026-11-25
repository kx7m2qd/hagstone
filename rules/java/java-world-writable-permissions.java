import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.EnumSet;
import java.util.Set;

public class Perms {
  void setup() throws Exception {
    Path uploads = Paths.get("/var/app/uploads");
    // ruleid: java-world-writable-permissions
    Files.setPosixFilePermissions(uploads, PosixFilePermissions.fromString("rwxrwxrwx"));

    Set<PosixFilePermission> perms = EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE);
    // ruleid: java-world-writable-permissions
    perms.add(PosixFilePermission.OTHERS_WRITE);
    Files.setPosixFilePermissions(Paths.get("/etc/app/config.yml"), perms);

    File script = new File("/var/app/run.sh");
    // ruleid: java-world-writable-permissions
    script.setWritable(true, false);

    // ok: java-world-writable-permissions
    Files.setPosixFilePermissions(uploads, PosixFilePermissions.fromString("rwxr-x---"));
    // ok: java-world-writable-permissions
    script.setWritable(true, true);
    // ok: java-world-writable-permissions
    script.setReadable(true, false);
  }
}
