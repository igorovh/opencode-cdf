# Records docs/demo.gif with VHS (https://github.com/charmbracelet/vhs) on Windows: `vhs docs/demo.tape`
# docs/demo-setup.ps1 runs OpenCode on a fake home and fake config, so no personal data shows up.
# Set OPENCODE_BIN if `opencode` on PATH is not OpenCode V2.
Output docs/demo.gif
Set Shell powershell
Set FontSize 16
Set Width 1280
Set Height 720
Set Padding 12
Set Framerate 24
Set TypingSpeed 90ms
Set Theme "Catppuccin Mocha"

Hide
Sleep 3s
# --standalone keeps the demo off the background service and its port.
Type "Set-ExecutionPolicy -Scope Process Bypass -Force; . ./docs/demo-setup.ps1; & $opencode --standalone" Enter
Sleep 40s
Show

Sleep 1s
Type "/cdf" Sleep 400ms Enter Sleep 1.5s

# Arrow keys, then star docs-site.
Down Sleep 600ms Down Sleep 600ms
Ctrl+F Sleep 1.5s

# Add a project. The prompt starts with the absolute path, so clear it off camera.
Hide
Ctrl+A Sleep 1s
Backspace 150
Show
Type "../billing" Sleep 600ms Enter Sleep 1s
Enter Sleep 1s
Down Sleep 500ms Enter Sleep 1.5s

# Filter and open: from Home this starts a new session in that project.
Type "web" Sleep 1s
Enter Sleep 3s
