<p align="center"> 
  <img src ="resources/logo.gif" />
</p>

[![check](https://github.com/Schneegans/Fly-Pie/workflows/Checks/badge.svg?branch=develop)](https://github.com/Schneegans/Fly-Pie/actions)
[![license](https://img.shields.io/badge/Gnome_Shell-3.36.2-blue.svg)](LICENSE)
[![license](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![comments](https://img.shields.io/badge/Comments-32.2%25-green.svg)](cloc.sh)

**Fly-Pie** is an attractive marking menu for Gnome-Shell.
It features a continuous learning curve which lets you gradually lift-off from a grumpie menu rookie to a snappie menu pielot.
(You got it? Like pilot, but with a :cake:).

# Getting Started

Fly-Pie is designed for people who have **one hand at the mouse** most of the time.
It is **not** designed to be used with a keyboard only; there are other applications which work better in this case (for example [kupfer](https://github.com/kupferlauncher/kupfer)).
Fly-Pie will also play nicely with **touch input**. 
While it might work already, a future version of Fly-Pie will be dedicated to add proper touch support.

## Features

Here is a list of Fly-Pie's major features. It provides both, a high-level overview of the current capabilities and a rough idea of planned features. You can also watch the video above to see Fly-Pie in action.

- [X] Create as many menus as you want
- [X] Bind menus to shortcuts
- [X] Create as deep menu hierarchies as you want
- [X] Two selection modes which can be used together
  - [X] **Point-and-Click:** Select items by clicking anywhere in the corresponding wedge
  - [X] **Marking-Mode:** Select items by drawing gestures
- [X] **Live Preview:** See your configuration changes instantaneously
- [X] Available Actions
  - [X] **Launch Application:** Executes any given shell command
  - [X] **Activate Shortcut:** Simulates a key stroke
  - [X] **Open URI:** Opens an URI with the default applications
  - [X] **Open File:** Opens a file with the default applications
- [X] Predefined Submenus
  - [X] **Bookmarks:** Shows your commonly used directories
  - [X] **Running Apps:** Shows the currently running applications
  - [X] **Recent Files:** Shows your recently used files
  - [X] **Frequently Used:** Shows your frequently used applications
  - [X] **Favorites:** Shows your pinned applications
  - [X] **Main Menu:** Shows all installed applications
- [X] D-Bus Interface
  - [X] Open pre-configured menus via the D-Bus
  - [X] Open custom menus via the D-Bus
- [ ] Proper touch-support
- [ ] Cool Presets
- [ ] Tutorials
- [ ] Achievements

## Installation

You can either install a stable release or grab the latest version directly with `git`.

### Installing a Stable Release

Just [download the latest release](https://github.com/Schneegans/Fly-Pie/releases) and extract the contained directory to `~/.local/share/gnome-shell/extensions`.
Then restart Gnome-Shell with <kbd>Alt</kbd> + <kbd>F2</kbd>, <kbd>r</kbd> + <kbd>Enter</kbd>.
Or logout / login if you are on Wayland.
Then you can enable the extension with the *Gnome Tweak Tool*, the *Extensions* application or with this command:

```bash
gnome-extensions enable flypie@schneegans.github.com
```

### Installing the Latest Version with `git`

```bash
cd ~/.local/share/gnome-shell/extensions
git clone https://github.com/Schneegans/Fly-Pie.git
mv Fly-Pie flypie@schneegans.github.com
```

Then restart Gnome-Shell with <kbd>Alt</kbd> + <kbd>F2</kbd>, <kbd>r</kbd> + <kbd>Enter</kbd>.
Or logout / login if you are on Wayland.
Then you can enable the extension with the *Gnome Tweak Tool*, the *Extensions* application or with this command:

```bash
gnome-extensions enable flypie@schneegans.github.com
```

## First Steps with Fly-Pie

If you installed and enabled Fly-Pie for the very first time, you can bring up the default menu with <kbd>Ctrl</kbd> + <kbd>Space</kbd>.

In a future version of Fly-Pie, there will be interactive tutorials demonstrating effective usage patterns.
For now, here are some hints to ease your path to become a master Pielot:
* You can **click anywhere in an item's wedge**. It does not matter whether you click directly on an item or at the edge of your screen as long as you are in the same wedge.
* To enter **Marking Mode**, click and drag an item. As soon as you pause dragging or make a turn, the item will be selected. **This way you can select items with gestures!**
* Try remembering the path to an item. Open the menu and **draw the path with your mouse**. You can start with individual segments of the path, put you can also try to draw the entire path!
* You may find it more successful if you explicitly try to compose your gesture of straight parts. **Do not draw curvy paths but rather expressive zig-zag-lines!**

### Bake Your First Pie Menu!

<img align="right" width="250px" src ="resources/menu-editor.png" />

While the default menu may give you the opportunity to play around with Fly-Pie, you will have to define your own menus!

The configuration dialog of Fly-Pie has three pages. On the first page you can define its **appearance**, on the second you can **define your own menus**. The last one... well, we will come to this later!

With the play-button you can always open a **live-preview** of your menu.
Just play around with the options, most of it should be more or less self-explanatory.

## Fly-Pie's D-Bus Interface

Fly-Pie has a D-Bus interface which allows not only to open configured menus via the commandline, but also to open completely custom-made menus defined with a JSON string.

### Opening Menu Configured with the Menu Editor

Use the following command to open a menu you configured with the Menu Editor.
The only parameter given to the `ShowMenu` method is the name of the menu.
There is also a similar method called `PreviewMenu` which will open the given menu in preview mode.

```bash
gdbus call --session --dest org.gnome.Shell                            \
  --object-path /org/gnome/shell/extensions/flypie                     \
  --method org.gnome.Shell.Extensions.flypie.ShowMenu 'My Menu'
```

### Opening Custom Menus via JSON

You can pass a JSON menu description to the `ShowCustomMenu` to show a custom menu. Here is an example showing a simple menu with two child elements:

```bash
gdbus call --session --dest org.gnome.Shell                            \
  --object-path /org/gnome/shell/extensions/flypie                     \
  --method org.gnome.Shell.Extensions.flypie.ShowCustomMenu            \
  '{"icon": "😀", "children": [                                        \
    {"name": "Rocket",   "icon":"🚀", "id":"a"},                       \
    {"name": "Doughnut", "icon":"🍩", "id":"b", "children": [          \
      {"name": "Cat",         "icon":"🐈"},                            \
      {"name": "Apatosaurus", "icon":"🦕"}                             \
    ]}                                                                 \
  ]}'
```

This JSON structure is quite simple. Each item may have the following properties:

* **`"name"`:** This will be shown in the center when the item is hovered.
* **`"icon"`:** Either an absolute path, an icon name (like `"firefox"`) or text. This is why we can use emoji for the icons!
* **`"id"` (optional):** Once an item is selected, this ID will be reported as part of the selection path. If omitted, the ID is the index of the child.
* **`"angle"` (optional, 0 - 359):** This forces the item to be placed in a specific direction. However, there is a restriction on the fixed angles. Inside a menu level, the fixed angles must be monotonically increasing, that is each fixed angle must be larger than any previous fixed angle.
* **`"children"` (optional):** An array of child items.

The method will return an integer.
This will be either negative (Fly-Pie failed to parse the provided description, see [DBusInterface.js](common/DBusInterface.js) for a list of error codes) or a positive ID which will be passed to the signals of the interface.

There are two signals; `OnCancel` will be fired when the user aborts the selection in a menu, `OnSelect` is activated when the user makes a selection.
Both signals send the ID which has been reported by the corresponding `ShowCustomMenu` call, in addition, `OnSelect` sends the path to the selected item.

You can use the following command to monitor the emitted signals:

```bash
gdbus monitor  --session --dest org.gnome.Shell \
  --object-path /org/gnome/shell/extensions/flypie
```

To see all available methods and signals you can introspect the interface:

```bash
gdbus introspect  --session --dest org.gnome.Shell                    \
  --object-path /org/gnome/shell/extensions/flypie
```

# Contributing to Fly-Pie

Whenever you encounter a :beetle: **bug** or have :tada: **feature request**, 
report this via [Github issues](https://github.com/schneegans/fly-pie/issues).

We are happy to receive contributions to Fly-Pie in the form of **pull requests** via Github.
Feel free to fork the repository, implement your changes and create a merge request to the `develop` branch.

Developing a Gnome-Shell extension is not easy, as debugging possibilities are quite limited. One thing you should always do is to monitor Gnome-Shells output for error or debug messages produced by Fly-Pie. This can be done like this:

```bash
journalctl /usr/bin/gnome-shell -f -o cat | grep flypie -B 2 -A 2
```

## Branching Guidelines

The development of Fly-Pie follows a simplified version of **git-flow**: The `master` branch always contains stable code.
New features and bug fixes are implemented in `feature/*` branches and are merged to `develop` once they are finished.
When a new milestone is reached, the content of `develop` will be merged to `master` and a tag is created.

## Git Commit Messages

Commits should start with a Capital letter and should be written in present tense (e.g. __:tada: Add cool new feature__ instead of __:tada: Added cool new feature__).
It's a great idea to start the commit message with an applicable emoji. This does not only look great but also makes you rethink what to add to a commit.

Emoji | Description
------|------------
:tada: `:tada:` | Added a cool new feature
:wrench: `:wrench:` | Refactored / improved a small piece of code
:hammer: `:hammer:` | Refactored / improved large parts of the code
:sparkles: `:sparkles:` | Applied clang-format
:art: `:art:` | Improved / added assets like themes
:rocket: `:rocket:` | Improved performance
:memo: `:memo:` | Wrote documentation
:beetle: `:beetle:` | Fixed a bug
:twisted_rightwards_arrows: `:twisted_rightwards_arrows:` | Merged a branch
:fire: `:fire:` | Removed something
:truck: `:truck:` | Moved / renamed something