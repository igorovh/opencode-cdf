# Records docs/demo.gif with VHS (https://github.com/charmbracelet/vhs): `vhs docs/demo.tape`
# Runs OpenCode on throwaway config, cache and state, so no personal paths show up.
Output docs/demo.gif
Set Shell bash
Set FontSize 16
Set Width 1200
Set Height 640
Set Theme "Catppuccin Mocha"

Hide
Type "export DEMO=$(mktemp -d) XDG_CONFIG_HOME=$DEMO/config XDG_CACHE_HOME=$DEMO/cache XDG_STATE_HOME=$DEMO/state HOME=$DEMO/home" Enter
Type "mkdir -p $HOME/code/{storefront,api,blog} $HOME/dotfiles && cd $HOME/code/api" Enter
Type "opencode plugin add github:igorovh/opencode-cdf && clear && opencode" Enter
Sleep 8s
Show

Type "/cdf" Sleep 300ms Enter Sleep 1s
# Add the current directory as a favorite.
Ctrl+A Sleep 800ms Enter Sleep 800ms Enter Sleep 800ms Enter Sleep 1s
Ctrl+A Sleep 800ms
Ctrl+U Type "~/code/storefront" Sleep 500ms Enter Sleep 800ms Enter Sleep 800ms Down Enter Sleep 1s
Ctrl+A Sleep 800ms
Ctrl+U Type "~/dotfiles" Sleep 500ms Enter Sleep 800ms Enter Sleep 800ms Down Enter Sleep 1s
Down Sleep 500ms Down Sleep 500ms Up Sleep 500ms
Ctrl+F Sleep 1.5s
Type "store" Sleep 1s
Enter Sleep 3s
