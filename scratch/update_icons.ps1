
$w = New-Object -ComObject WScript.Shell

$s1 = $w.CreateShortcut('C:\Users\lagacepe\Desktop\Cassetto Audio Recorder.lnk')
$s1.TargetPath = 'C:\Users\lagacepe\Desktop\Cassetto-Win95-AudioRecorder\Cassetto.exe'
$s1.WorkingDirectory = 'C:\Users\lagacepe\Desktop\Cassetto-Win95-AudioRecorder'
$s1.IconLocation = 'C:\Users\lagacepe\Desktop\Cassetto-Win95-AudioRecorder\assets\cassette.ico'
$s1.Description = 'Cassetto - Win95 Audio Recorder'
$s1.Save()

$s2 = $w.CreateShortcut('C:\Users\lagacepe\Desktop\Cassetto-Win95-AudioRecorder\Cassetto Audio Recorder.lnk')
$s2.TargetPath = 'C:\Users\lagacepe\Desktop\Cassetto-Win95-AudioRecorder\Cassetto.exe'
$s2.WorkingDirectory = 'C:\Users\lagacepe\Desktop\Cassetto-Win95-AudioRecorder'
$s2.IconLocation = 'C:\Users\lagacepe\Desktop\Cassetto-Win95-AudioRecorder\assets\cassette.ico'
$s2.Description = 'Cassetto - Win95 Audio Recorder'
$s2.Save()

Write-Host "Shortcut icons updated."
