import { FolderIcon, getFileIcon, MaterialIcon } from "react-material-icon-theme";

type Props = {
  name: string;
  isDir: boolean;
  isOpen?: boolean;
  isRoot?: boolean;
  size?: number;
};

/** VS Code Material Icon Theme — filename maps to the matching icon. */
export function FileTypeIcon({
  name,
  isDir,
  isOpen = false,
  isRoot = false,
  size = 16,
}: Props) {
  if (isDir) {
    return (
      <FolderIcon
        folderName={name}
        isOpen={isOpen}
        isRoot={isRoot}
        size={size}
        className="shrink-0"
      />
    );
  }

  return (
    <MaterialIcon
      name={resolveFileIcon(name)}
      size={size}
      className="shrink-0"
    />
  );
}

/**
 * The package only checks `fileExtension` when that prop is set — it does not
 * peel an extension off `fileName`. Try the full name, then compound suffixes
 * (`d.ts`, then `ts`) so `.rs` / `.toml` / `.json` resolve like VS Code.
 */
function resolveFileIcon(fileName: string): string {
  const key = fileName.toLowerCase();
  const fromName = getFileIcon({ fileName: key, fallback: "", iconPack: "" });
  if (fromName) return fromName;

  for (const ext of compoundExtensions(key)) {
    const fromExt = getFileIcon({
      fileExtension: ext,
      fallback: "",
      iconPack: "",
    });
    if (fromExt) return fromExt;
  }

  return "file";
}

function compoundExtensions(fileName: string): string[] {
  const parts = fileName.split(".");
  const start = parts[0] === "" ? 1 : 0;
  const exts: string[] = [];
  for (let i = start + 1; i < parts.length; i++) {
    exts.push(parts.slice(i).join("."));
  }
  return exts;
}
