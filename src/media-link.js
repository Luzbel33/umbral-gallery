export function mediaLink(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, ""),
    path = url.pathname.split("/").filter(Boolean);
  if (["youtube.com", "m.youtube.com", "youtu.be"].includes(host)) {
    const id =
      host === "youtu.be"
        ? path[0]
        : path[0] === "watch"
          ? url.searchParams.get("v")
          : ["shorts", "embed"].includes(path[0])
            ? path[1]
            : null;
    if (!/^[\w-]{11}$/.test(id || "")) return null;
    return {
      extension: "youtube",
      type: "video",
      name: "YouTube",
      url: "https://www.youtube.com/watch?v=" + id,
      embed: "https://www.youtube-nocookie.com/embed/" + id,
    };
  }
  if (host === "vimeo.com" && path.length === 1 && /^\d{1,12}$/.test(path[0]))
    return {
      extension: "vimeo",
      type: "video",
      name: "Vimeo",
      url: "https://vimeo.com/" + path[0],
      embed: "https://player.vimeo.com/video/" + path[0] + "?dnt=1",
    };
  if (
    host === "soundcloud.com" &&
    path.length === 2 &&
    /^[\w-]{1,100}$/.test(path[0]) &&
    /^[\w-]{1,180}$/.test(path[1])
  ) {
    const link = "https://soundcloud.com/" + path.join("/");
    return {
      extension: "soundcloud",
      type: "audio",
      name: "SoundCloud",
      url: link,
      embed:
        "https://w.soundcloud.com/player/?auto_play=false&url=" +
        encodeURIComponent(link),
    };
  }
  return null;
}
