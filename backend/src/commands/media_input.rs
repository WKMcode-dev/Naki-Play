use reqwest::Url;

/// Accept one URL, including text produced by a share sheet. Never guess between links.
pub fn normalize_url(value: &str) -> Result<String, String> {
    let value = value.trim();
    let candidates: Vec<_> = value
        .split_whitespace()
        .filter(|part| part.starts_with("https://") || part.starts_with("http://"))
        .collect();
    let candidate = match candidates.as_slice() {
        [one] => *one,
        [] => value,
        _ => return Err("cole apenas um link por vez".into()),
    };
    let candidate = if [
        "youtube.com/",
        "www.youtube.com/",
        "m.youtube.com/",
        "music.youtube.com/",
        "youtu.be/",
    ]
    .iter()
    .any(|prefix| candidate.starts_with(prefix))
    {
        format!("https://{candidate}")
    } else {
        candidate.to_string()
    };
    let mut url = Url::parse(&candidate)
        .map_err(|_| "cole um link válido começando com https:// ou http://".to_string())?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err("somente links http:// e https:// são aceitos".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("links com usuário ou senha não são aceitos".into());
    }
    let host = url.host_str().unwrap_or_default();
    let is_youtube = matches!(
        host,
        "youtube.com"
            | "www.youtube.com"
            | "m.youtube.com"
            | "music.youtube.com"
            | "youtube-nocookie.com"
            | "www.youtube-nocookie.com"
            | "youtu.be"
            | "www.youtu.be"
    );
    if is_youtube {
        let segments: Vec<_> = url.path().trim_matches('/').split('/').collect();
        let id = if matches!(host, "youtu.be" | "www.youtu.be") && segments.len() == 1 {
            Some(segments[0].to_string())
        } else if url.path() == "/watch" {
            url.query_pairs()
                .find(|(key, _)| key == "v")
                .map(|(_, value)| value.into_owned())
        } else if segments.len() == 2 && matches!(segments[0], "shorts" | "live" | "embed" | "v") {
            Some(segments[1].to_string())
        } else {
            None
        };
        let id = id.filter(|id| id.len() == 11 && id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-'))
            .ok_or_else(|| "esse link não identifica um vídeo; abra a música ou vídeo e use Compartilhar → Copiar link".to_string())?;
        return Ok(format!("https://www.youtube.com/watch?v={id}"));
    }
    url.set_fragment(None);
    Ok(url.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn youtube_link_matrix() {
        let id = "o3-Izz60iTQ";
        for host in [
            "www.youtube.com",
            "m.youtube.com",
            "music.youtube.com",
            "youtube.com",
        ] {
            for suffix in ["", "&list=PLtest&index=2", "&si=tracking&t=20", "#t=10"] {
                for prefix in ["", "  ", "Olha esta música!\n"] {
                    let input = format!("{prefix}https://{host}/watch?v={id}{suffix}");
                    assert_eq!(
                        normalize_url(&input).unwrap(),
                        format!("https://www.youtube.com/watch?v={id}"),
                        "{input}"
                    );
                }
            }
        }
        for path in [
            format!("youtu.be/{id}?si=abc"),
            format!("youtube.com/shorts/{id}"),
            format!("youtube.com/live/{id}"),
            format!("www.youtube-nocookie.com/embed/{id}"),
        ] {
            assert_eq!(
                normalize_url(&format!("https://{path}")).unwrap(),
                format!("https://www.youtube.com/watch?v={id}")
            );
        }
        assert!(normalize_url(&format!("youtu.be/{id}")).is_ok());
    }

    #[test]
    fn rejects_ambiguous_private_and_non_video_inputs() {
        for input in [
            "",
            "não é link",
            "file:///song.mp3",
            "content://media/123",
            "javascript:alert(1)",
            "https://user:password@example.org/music",
            "https://youtube.com/playlist?list=abc",
            "https://youtube.com/watch?v=invalid",
            "https://example.org/a https://example.org/b",
        ] {
            assert!(normalize_url(input).is_err(), "{input}");
        }
    }

    #[test]
    fn keeps_signed_direct_links_and_does_not_trust_lookalike_hosts() {
        let signed = "https://example.org/a%20b.mp3?sig=a%2Fb&expires=42";
        assert_eq!(normalize_url(signed).unwrap(), signed);
        assert_eq!(
            normalize_url("https://youtube.com.example.org/watch?v=123").unwrap(),
            "https://youtube.com.example.org/watch?v=123"
        );
    }
}
