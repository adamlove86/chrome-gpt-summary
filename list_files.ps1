# list_files.ps1

Get-ChildItem -File | Where-Object { $_.Extension -notmatch '\.(jpg|png|gif|jpeg|bmp|exe|dll|zip|tar|gz|7z)$' } | ForEach-Object {
    Write-Host $_.FullName;
    Get-Content $_.FullName;
    Write-Host "`n`n";
}
