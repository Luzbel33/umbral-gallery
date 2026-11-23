import { projectUrl, publicKey } from "./config.js";

const chunkSize = 6 * 1024 ** 2;
async function request(client, id, op, options = {}, body) {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) throw Error("MEDIA_ACCOUNT");
  const url = new URL(projectUrl + "/functions/v1/gallery-media");
  url.search = new URLSearchParams({ work: id, op, ...options });
  const r = await fetch(url, {
    method: "POST",
    headers: {
      apikey: publicKey,
      Authorization: "Bearer " + data.session.access_token,
    },
    body,
    credentials: "omit",
  });
  if (!r.ok)
    throw Error(
      (await r.json().catch(() => ({}))).error || "MEDIA_UNAVAILABLE",
    );
}
export function usesCloudFile(item) {
  return (
    item.extension !== "pdf" &&
    (!["webp", "mesh", "txt"].includes(item.extension) ||
      item.blob.size <= 10000000)
  );
}
export async function uploadCloudWork(client, file, title, item) {
  const id = crypto.randomUUID();
  const { error } = await client.rpc("reserve_gallery_upload", {
    work_key: id,
    work_title: title,
    filename: file.name.slice(-120),
    ext: item.extension,
    bytes: item.blob.size,
    thumb: item.preview?.size || 0,
  });
  if (error) throw error;
  async function send(blob, preview) {
    for (let offset = 0; offset < blob.size; offset += chunkSize)
      await request(
        client,
        id,
        "upload",
        { offset: String(offset), preview: preview ? "1" : "0" },
        blob.slice(offset, offset + chunkSize, "application/octet-stream"),
      );
  }
  try {
    await send(item.blob, false);
    if (item.preview) await send(item.preview, true);
  } catch (error) {
    // A row remains visible to its owner if an interrupted upload needs cleanup.
    await deleteCloudWork(client, id).catch(() => {});
    throw error;
  }
}
export const deleteCloudWork = (client, id) => request(client, id, "delete");
