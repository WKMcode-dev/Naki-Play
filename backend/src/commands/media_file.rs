use std::{fs::File, io::Read, path::Path};

pub const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp3", "wav", "m4a", "aac", "flac", "ogg", "opus", "mp4", "webm", "mov",
];

pub fn extension_from_name(value: &str) -> Option<String> {
    Path::new(value)
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .filter(|ext| SUPPORTED_EXTENSIONS.contains(&ext.as_str()))
}

pub fn extension_from_mime(mime: &str) -> Option<&'static str> {
    match mime.split(';').next()?.trim().to_ascii_lowercase().as_str() {
        "audio/mpeg" | "audio/mp3" => Some("mp3"),
        "audio/wav" | "audio/x-wav" | "audio/vnd.wave" => Some("wav"),
        "audio/aac" | "audio/aacp" | "audio/x-aac" => Some("aac"),
        "audio/flac" | "audio/x-flac" => Some("flac"),
        "audio/ogg" | "application/ogg" => Some("ogg"),
        "audio/opus" => Some("opus"),
        "audio/mp4" | "audio/m4a" | "audio/x-m4a" => Some("m4a"),
        "video/mp4" => Some("mp4"),
        "video/webm" | "audio/webm" => Some("webm"),
        "video/quicktime" => Some("mov"),
        _ => None,
    }
}

/// Names and server MIME types are hints, not proof that a download contains media.
pub fn detect_bytes(bytes: &[u8], name: &str) -> Result<String, String> {
    if bytes.is_empty() {
        return Err("o arquivo está vazio; baixe ou copie o original novamente".into());
    }
    let kind = infer::get(bytes);
    let extension = kind
        .as_ref()
        .and_then(|kind| extension_from_mime(kind.mime_type()));
    if let Some(extension) = extension {
        // ISO-BMFF shares its container across audio/video. Preserve an explicit audio name.
        let extension = if extension == "mp4" && extension_from_name(name).as_deref() == Some("m4a")
        {
            "m4a"
        } else {
            extension
        };
        return Ok(extension.into());
    }
    // infer's MP3 matcher misses valid MPEG-2/2.5 and CRC-protected frame headers.
    if bytes.len() >= 4
        && bytes[0] == 0xff
        && bytes[1] & 0xe0 == 0xe0
        && bytes[1] & 0x18 != 0x08
        && bytes[1] & 0x06 == 0x02
        && !matches!(bytes[2] >> 4, 0 | 15)
        && bytes[2] & 0x0c != 0x0c
    {
        return Ok("mp3".into());
    }
    Err("o conteúdo não foi reconhecido como áudio ou vídeo compatível. Renomear a extensão não converte o arquivo; selecione o original completo (não uma página, atalho ou arquivo protegido de outro app)".into())
}

pub fn detect_extension(path: &Path, name: &str) -> Result<String, String> {
    let mut header = Vec::new();
    File::open(path)
        .and_then(|file| file.take(8192).read_to_end(&mut header))
        .map_err(|error| format!("não foi possível identificar o formato: {error}"))?;
    detect_bytes(&header, name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn content_wins_over_names_matrix() {
        let mut opus = b"OggS".to_vec();
        opus.resize(28, 0);
        opus.extend(b"OpusHead");
        let cases: Vec<(&[u8], &str)> = vec![
            (b"ID3\x04\0\0\0\0\0\0", "mp3"),
            (b"RIFF1234WAVEfmt ", "wav"),
            (b"fLaC12345678", "flac"),
            (b"OggS123456789", "ogg"),
            (&opus, "opus"),
            (b"\0\0\0\x18ftypM4A \0\0\0\0M4A isom", "m4a"),
            (&[0xff, 0xf1, 0x50, 0x80], "aac"),
            (&[0xff, 0xfa, 0x90, 0], "mp3"),
        ];
        for (bytes, expected) in cases {
            for name in [
                "12345",
                "",
                "áudio com espaços.bin",
                "FAIXA.MP3",
                "wrong.mp4",
            ] {
                assert_eq!(
                    detect_bytes(bytes, name).unwrap(),
                    expected,
                    "{expected}: {name}"
                );
            }
        }
    }

    #[test]
    fn rejects_fake_empty_and_non_media_files_even_with_trusted_extension() {
        for data in [
            b"".as_slice(),
            b"<html>Access denied</html>",
            b"{\"error\":403}",
            b"not media",
            b"%PDF-1.5",
        ] {
            for ext in SUPPORTED_EXTENSIONS {
                assert!(detect_bytes(data, &format!("file.{ext}")).is_err());
            }
        }
    }

    #[test]
    fn maps_android_m4a_aliases() {
        for mime in [
            "audio/m4a",
            "audio/x-m4a",
            "audio/mp4",
            "Audio/MP4; charset=utf-8",
        ] {
            assert_eq!(extension_from_mime(mime), Some("m4a"));
        }
    }

    /// Real, locally generated fixtures; enabled by the compatibility script.
    #[test]
    fn generated_media_matrix() {
        let Ok(root) = std::env::var("NAKI_MEDIA_FIXTURES") else {
            return;
        };
        for ext in SUPPORTED_EXTENSIONS {
            let path = Path::new(&root).join(format!("sample.{ext}"));
            for name in [
                format!("sample.{ext}"),
                "1234".into(),
                "incorrect.mp3".into(),
            ] {
                let actual =
                    detect_extension(&path, &name).unwrap_or_else(|e| panic!("{ext}: {e}"));
                assert!(SUPPORTED_EXTENSIONS.contains(&actual.as_str()));
            }
        }
    }
}
