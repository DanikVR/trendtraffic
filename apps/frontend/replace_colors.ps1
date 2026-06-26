$files = Get-ChildItem -Path "src" -Recurse -Include "*.tsx","*.ts","*.css"

$replacements = [ordered]@{
    "#4338CA"         = "#2563EB"
    "#6366F1"         = "#3B82F6"
    "#818CF8"         = "#60A5FA"
    "#A5B4FC"         = "#93C5FD"
    "#4F6EF7"         = "#3B82F6"
    "79,110,247"      = "59,130,246"
    "99,102,241"      = "59,130,246"
    "67,56,202"       = "37,99,235"
    "#312E81"         = "#1E3A8A"
    "#3730A3"         = "#1D4ED8"
    "#1E1B4B"         = "#1E3A8A"
    "#0F0E2A"         = "#0C1A3A"
    "#EEF2FF"         = "#EFF6FF"
    "#E0E7FF"         = "#DBEAFE"
    "#C7D2FE"         = "#BFDBFE"
}

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $content
    foreach ($key in $replacements.Keys) {
        $content = $content.Replace($key, $replacements[$key])
    }
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        Write-Host "Updated: $($file.Name)"
    }
}
Write-Host "Done!"
