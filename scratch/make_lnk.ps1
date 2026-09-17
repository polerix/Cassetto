
$w = New-Object -ComObject WScript.Shell

# Desktop Shortcut
$s1 = $w.CreateShortcut('C:\Users\lagacepe\Desktop\Cassetto.lnk')
$s1.TargetPath = 'C:\Users\lagacepe\Desktop\Cassetto-Win95-AudioRecorder\dist\win-unpacked\Cassetto.exe'
$s1.WorkingDirectory = 'C:\Users\lagacepe\Desktop\Cassetto-Win95-AudioRecorder\dist\win-unpacked'
$s1.IconLocation = 'C:\Users\lagacepe\Desktop\Cassetto-Win95-AudioRecorder\assets\cassette.ico'
$s1.Description = 'Cassetto'
$s1.Save()

Write-Host "Desktop Shortcut created successfully."
