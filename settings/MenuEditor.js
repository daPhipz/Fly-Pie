//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Cairo                                 = imports.cairo;
const {GObject, Gdk, GLib, Gtk, Gio, Pango} = imports.gi;

const Me            = imports.misc.extensionUtils.getCurrentExtension();
const utils         = Me.imports.common.utils;
const DBusInterface = Me.imports.common.DBusInterface.DBusInterface;

const DBusWrapper = Gio.DBusProxy.makeProxyWrapper(DBusInterface.description);

// These are the different columns of the MenuTreeStore. It contains basically all data of
// all configured menus. This could be a static member of the class below, but this seems
// to be not supported yet.
// clang-format off
let ColumnTypes = {
  DISPLAY_ICON:     Cairo.Surface.$gtype,  // The actual pixbuf of the icon.
  DISPLAY_NAME:     GObject.TYPE_STRING,   // The name with markup. 
  DISPLAY_ANGLE:    GObject.TYPE_STRING,   // Empty if angle is -1
  DETAILS:          GObject.TYPE_STRING,   // The text of the middle column.
  ICON:             GObject.TYPE_STRING,   // The string representation of the icon.
  NAME:             GObject.TYPE_STRING,   // The name without any markup.
  TYPE:             GObject.TYPE_STRING,   // The item type. Like 'menu' or 'url'.
  DATA:             GObject.TYPE_STRING,   // Used for the command, file, application, ...
  COUNT:            GObject.TYPE_DOUBLE,   // The max-item-count of some sub-menus.
  ANGLE:            GObject.TYPE_DOUBLE    // The fixed angle.
}
// clang-format on

//////////////////////////////////////////////////////////////////////////////////////////
// The MenuTreeStore differs from a normal Gtk.TreeStore only in the drag'n'drop        //
// behavior. It ensures that top-level menus cannot be dragged at all and the all       //
// other items or sub-menus are only dropped to top-level menus or to sub-menus.        //
//////////////////////////////////////////////////////////////////////////////////////////

let MenuTreeStore = GObject.registerClass({}, class MenuTreeStore extends Gtk.TreeStore {
  _init() {
    super._init();

    let columnTypes = [];

    // This public property will contain the column id for each ColumnType.
    this.columns = {};

    let lastColumnID = -1;
    for (const name in ColumnTypes) {
      columnTypes.push(ColumnTypes[name]);
      this.columns[name] = ++lastColumnID;
    }

    this.set_column_types(columnTypes);
  }

  // This makes sure that we cannot drag top-level menus. All other items or sub-menus can
  // be dragged around.
  vfunc_row_draggable(path) {
    return path.get_depth() > 1;
  }

  // This ensures that items or sub-menus are only dropped on top-level menus or
  // sub-menus.
  vfunc_row_drop_possible(path) {
    const parentPath = path.copy();
    if (parentPath.up()) {
      const [ok, parent] = this.get_iter(parentPath);
      if (ok) {
        const type = this.get_value(parent, this.columns.TYPE);
        if (type === 'submenu' || type === 'menu') {
          return true;
        }
      }
    }
    return false;
  }

  // This resets any fixed angle of dragged items. While this isn't really necessary in
  // all cases, but identifying cases when an invalid fixed-angle configuration is created
  // is quite complex. This could be improved in the future!
  vfunc_drag_data_get(path, selection_data) {
    const [ok, iter] = this.get_iter(path);
    if (ok) {
      this.set_value(iter, this.columns.ANGLE, -1);
      this.set_value(iter, this.columns.DISPLAY_ANGLE, '');
    }
    return super.vfunc_drag_data_get(path, selection_data);
  }
});

//////////////////////////////////////////////////////////////////////////////////////////
// The MenuEditor class encapsulates code required for the 'Menu Editor' page of the    //
// settings dialog. It's not instantiated multiple times, nor does it have any public   //
// interface, hence it could just be copy-pasted to the settings class. But as it's     //
// quite decoupled as well, it structures the code better when written to its own file. //
//////////////////////////////////////////////////////////////////////////////////////////

var MenuEditor = class MenuEditor {

  // ------------------------------------------------------------ constructor / destructor

  constructor(builder) {

    this._builder = builder;

    // Create the Gio.Settings object.
    this._settings = utils.createSettings();

    // Connect to the server so that we can toggle menu previews from the menu editor.
    new DBusWrapper(
        Gio.DBus.session, 'org.gnome.Shell', '/org/gnome/shell/extensions/swingpie',
        proxy => this._dbus = proxy);

    let menus = [
      {
        type: 'menu',
        icon: 'gedit',
        name: 'Main Menu',
        data: 'Ctrl+A',
        fixedAngle: -1,
        children: []
      },
      {
        type: 'menu',
        icon: 'thunderbird',
        name: 'Main Menu 2',
        data: 'Ctrl+B',
        fixedAngle: -1,
        children: [
          {
            type: 'submenu',
            icon: 'emblem-default',
            name: 'Favorites',
            data: '',
            fixedAngle: 90,
          },
          {
            type: 'application',
            icon: 'firefox',
            name: 'Firefox',
            data: 'Firefox',
            fixedAngle: -1,
          },
          {
            type: 'command',
            icon: 'terminal',
            name: 'Grep',
            data: 'grep foo',
            fixedAngle: -1,
          },
          {
            type: 'hotkey',
            icon: 'H',
            name: 'Hotkey',
            data: 'Ctrl+V',
            fixedAngle: 270,
          },
        ]
      },
      {
        type: 'menu',
        icon: 'chrome',
        name: 'Main Menu 3',
        data: 'Ctrl+C',
        fixedAngle: -1,
        children: [
          {
            type: 'bookmarks-group',
            icon: 'nautilus',
            name: 'Bookmarks',
            data: '',
            fixedAngle: -1,
          },
          {
            type: 'url',
            icon: 'epiphany',
            name: 'URL',
            data: 'http://www.google.de',
            fixedAngle: -1,
          },
          {
            type: 'file',
            icon: 'nautilus',
            name: 'File 1',
            data: 'file://huhu',
            fixedAngle: -1,
          },
          {
            type: 'file',
            icon: 'nautilus',
            name: 'File 2',
            data: 'file://huhu',
            fixedAngle: -1,
          },
        ]
      },
    ];

    try {
      // Create our custom tree store and assign it to the tree view of the builder.
      this._store     = new MenuTreeStore();
      this._selection = this._builder.get_object('menus-treeview-selection');
      this._view      = this._builder.get_object('menus-treeview');
      this._view.set_model(this._store);

      this._view.connect('key-release-event', (widget, event) => {
        if (event.get_keyval()[1] == Gdk.keyval_from_name('Delete')) {
          this._deleteSelected();
          return true;
        }
        return false;
      });

      // This is kind of a weird hack (?) to keep a row selected after drag'n'drop. We
      // simply select every row after it was inserted. This does not work if we directly
      // attempt to select it, we have to use a short timeout.
      this._store.connect(
          'row-inserted',
          (widget, path, iter) => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1, () => {
            this._selection.select_iter(iter);
            return false;
          }));


      const menuColumn = new Gtk.TreeViewColumn({
        title: 'Menu Structure',
        expand: true,
        sizing: Gtk.TreeViewColumnSizing.AUTOSIZE
      });
      const iconRender = new Gtk.CellRendererPixbuf();
      const nameRender = new Gtk.CellRendererText({xpad: 5});
      menuColumn.pack_start(iconRender, false);
      menuColumn.pack_start(nameRender, true);
      menuColumn.add_attribute(iconRender, 'surface', this._store.columns.DISPLAY_ICON);
      menuColumn.add_attribute(nameRender, 'markup', this._store.columns.DISPLAY_NAME);

      const detailsColumn = new Gtk.TreeViewColumn({
        title: 'Item Details',
        expand: true,
        sizing: Gtk.TreeViewColumnSizing.AUTOSIZE
      });
      const detailsRender = new Gtk.CellRendererText(
          {sensitive: false, ellipsize: Pango.EllipsizeMode.MIDDLE});
      detailsColumn.pack_start(detailsRender, true);
      detailsColumn.add_attribute(detailsRender, 'markup', this._store.columns.DETAILS);

      const angleColumn = new Gtk.TreeViewColumn(
          {title: 'Fixed Angle', sizing: Gtk.TreeViewColumnSizing.AUTOSIZE});
      const angleRender = new Gtk.CellRendererText({sensitive: false, xalign: 0.5});
      angleColumn.pack_start(angleRender, true);
      angleColumn.add_attribute(angleRender, 'markup', this._store.columns.DISPLAY_ANGLE);

      this._view.append_column(menuColumn);
      this._view.append_column(detailsColumn);
      this._view.append_column(angleColumn);


      for (let i = 0; i < menus.length; i++) {
        const menu = menus[i];
        const iter = this._store.append(null);

        this._set(iter, 'ICON', menu.icon);
        this._set(iter, 'NAME', menu.name);
        this._set(iter, 'TYPE', menu.type);
        this._set(iter, 'DATA', menu.data);
        this._set(iter, 'ANGLE', menu.fixedAngle);


        for (let j = 0; j < menu.children.length; j++) {
          const child     = menu.children[j];
          const childIter = this._store.append(iter);

          this._set(childIter, 'ICON', child.icon);
          this._set(childIter, 'NAME', child.name);
          this._set(childIter, 'TYPE', child.type);
          this._set(childIter, 'DATA', child.data);
          this._set(childIter, 'ANGLE', child.fixedAngle);
        }
      }
    } catch (error) {
      utils.notification('Failed to initialize Menu Editor: ' + error);
    }


    this._selection.connect('changed', (selection) => {
      try {
        let selectedType      = 'none';
        let somethingSelected = selection.get_selected()[0];

        if (somethingSelected) {
          this._builder.get_object('icon-name').text = this._getSelected('ICON');
          this._builder.get_object('item-name').text = this._getSelected('NAME');

          selectedType = this._getSelected('TYPE');

          if (selectedType != 'menu') {
            this._builder.get_object('item-angle').value = this._getSelected('ANGLE');
          }

          if (selectedType == 'url') {
            this._builder.get_object('item-url').text = this._getSelected('DATA');

          } else if (selectedType == 'command') {
            this._builder.get_object('item-command').text = this._getSelected('DATA');

          } else if (selectedType == 'recent') {
            this._builder.get_object('item-count').value = this._getSelected('COUNT');
          }
        }

        this._builder.get_object('preview-menu-button').sensitive     = somethingSelected;
        this._builder.get_object('remove-item-button').sensitive      = somethingSelected;
        this._builder.get_object('item-type-hotkey').sensitive        = somethingSelected;
        this._builder.get_object('item-type-application').sensitive   = somethingSelected;
        this._builder.get_object('item-type-file').sensitive          = somethingSelected;
        this._builder.get_object('item-type-url').sensitive           = somethingSelected;
        this._builder.get_object('item-type-command').sensitive       = somethingSelected;
        this._builder.get_object('item-type-submenu').sensitive       = somethingSelected;
        this._builder.get_object('item-type-bookmarks').sensitive     = somethingSelected;
        this._builder.get_object('item-type-recent-files').sensitive  = somethingSelected;
        this._builder.get_object('item-type-favorite-apps').sensitive = somethingSelected;
        this._builder.get_object('item-type-frequent-apps').sensitive = somethingSelected;
        this._builder.get_object('item-type-running-apps').sensitive  = somethingSelected;
        this._builder.get_object('item-type-main-menu').sensitive     = somethingSelected;

        const revealers = {
          'item-settings-revealer': selectedType != 'none',
          'item-settings-menu-hotkey-revealer': selectedType == 'menu',
          'item-settings-angle-revealer': selectedType != 'menu',
          'item-settings-item-hotkey-revealer': selectedType == 'hotkey',
          'item-settings-count-revealer': selectedType == 'recent',
          'item-settings-url-revealer': selectedType == 'url',
          'item-settings-command-revealer': selectedType == 'command',
          'item-settings-file-revealer': selectedType == 'file',
          'item-settings-application-revealer': selectedType == 'application',
        };

        for (const revealer in revealers) {
          this._builder.get_object(revealer).reveal_child = revealers[revealer];
        }

      } catch (error) {
        utils.notification('Failed to update menu editor selection: ' + error);
      }
    });



    this._loadIcons().then(() => {
      this._builder.get_object('icon-load-spinner').active = false;
    });

    const iconListFiltered = this._builder.get_object('icon-list-filtered');
    const filterEntry      = this._builder.get_object('icon-filter-entry');
    iconListFiltered.set_visible_func((model, iter) => {
      const name = model.get_value(iter, 0);
      if (name == null) {
        return false;
      }
      return name.toLowerCase().includes(filterEntry.text.toLowerCase());
    });

    // refilter on input
    filterEntry.connect('notify::text', () => {
      iconListFiltered.refilter();
    });

    const iconView = this._builder.get_object('icon-view');
    iconView.connect('item-activated', (view, path) => {
      this._builder.get_object('icon-popover').popdown();
    });

    iconView.connect('selection-changed', (view) => {
      const path       = view.get_selected_items()[0];
      const model      = view.get_model();
      const [ok, iter] = model.get_iter(path);
      if (ok) {
        this._builder.get_object('icon-name').text = model.get_value(iter, 0);
      }
    });

    const iconChooser = this._builder.get_object('icon-file-chooser');
    iconChooser.connect('file-activated', (chooser) => {
      this._builder.get_object('icon-popover').popdown();
    });

    iconChooser.connect('selection-changed', (chooser) => {
      this._builder.get_object('icon-name').text = chooser.get_filename();
    });

    this._builder.get_object('item-name').connect('notify::text', (widget) => {
      this._setSelected('NAME', widget.text);
    });

    this._builder.get_object('item-angle').connect('value-changed', (adjustment) => {
      let minAngle                     = -1
      let maxAngle                     = 360
      const [ok1, model, selectedIter] = this._selection.get_selected();
      if (!ok1) return;

      const [ok2, parentIter] = model.iter_parent(selectedIter);
      if (!ok2) return;

      const selectedIndices = model.get_path(selectedIter).get_indices();
      const selectedIndex   = selectedIndices[selectedIndices.length - 1];
      const nChildren       = model.iter_n_children(parentIter);

      for (let n = 0; n < nChildren; n++) {
        const angle = this._get(model.iter_nth_child(parentIter, n)[1], 'ANGLE');

        if (n < selectedIndex) {
          minAngle = angle;
        }

        if (n > selectedIndex && angle >= 0) {
          maxAngle = angle;
          break;
        }
      }

      if (adjustment.value == -1 ||
          (adjustment.value > minAngle && adjustment.value < maxAngle)) {
        this._setSelected('ANGLE', adjustment.value);
      }
    });

    this._builder.get_object('item-count').connect('value-changed', (adjustment) => {
      this._setSelected('COUNT', adjustment.value);
    });

    this._builder.get_object('icon-name').connect('notify::text', (widget) => {
      this._setSelected('ICON', widget.text);
      this._itemIcon.queue_draw();
    });

    this._itemIcon = this._builder.get_object('item-icon-drawingarea');
    this._itemIcon.connect('draw', (widget, ctx) => {
      const size = Math.min(widget.get_allocated_width(), widget.get_allocated_height());
      const icon = this._getSelected('ICON');
      utils.paintIcon(ctx, icon, size, 1);
      return false;
    });

    this._builder.get_object('item-url').connect('notify::text', (widget) => {
      this._setSelected('DATA', widget.text);
    });

    this._builder.get_object('item-command').connect('notify::text', (widget) => {
      this._setSelected('DATA', widget.text);
    });

    this._builder.get_object('item-file-chooser').connect('file-activated', (widget) => {
      this._builder.get_object('item-file-popover').popdown();
    });

    this._builder.get_object('item-file-chooser')
        .connect('selection-changed', (widget) => {
          this._setSelected('DATA', widget.get_filename());
          const info = widget.get_file().query_info('standard::icon', 0, null);
          this._builder.get_object('icon-name').text = info.get_icon().to_string();
          this._builder.get_object('item-name').text = widget.get_file().get_basename();
        });

    this._builder.get_object('application-popover-list')
        .connect('application-activated', (widget, app) => {
          this._builder.get_object('item-application-popover').popdown();
        });

    this._builder.get_object('application-popover-list')
        .connect('application-selected', (widget, app) => {
          this._setSelected('DATA', app.get_commandline());
          this._builder.get_object('icon-name').text = app.get_icon().to_string();
          this._builder.get_object('item-name').text = app.get_display_name();
        });

    this._hotkeyButton = this._builder.get_object('menu-hotkey');
    this._hotkeyButton.connect('toggled', (widget) => {
      if (widget.active) {
        widget.set_label('Press a hotkey ...');
        widget.grab_add();
        // Gtk.grab_add(widget);
        // FocusGrabber.grab(this.get_window());
      } else {
        widget.grab_remove();
      }
    });

    this._builder.get_object('remove-item-button').connect('clicked', () => {
      this._deleteSelected();
    });

    this._builder.get_object('item-types').connect('row-activated', (widget, row) => {
      const type = row.get_name().slice(10);

      if (type == 'menu') {
        const iter = this._store.append(null);
        this._set(iter, 'ICON', this._getRandomEmoji());
        this._set(iter, 'NAME', 'Submenu');
        this._set(iter, 'TYPE', 'menu');
        this._set(iter, 'Data', 'Not Bound');
        this._set(iter, 'ANGLE', -1);
      } else {

        const selectedType          = this._getSelected('TYPE');
        const [ok, model, selected] = this._selection.get_selected();
        let iter                    = null;

        if (selectedType == 'menu' || selectedType == 'submenu') {
          iter = this._store.append(selected);
        } else {
          const parent = model.iter_parent(selected)[1];
          iter         = this._store.insert_after(parent, selected);
        }

        this._set(iter, 'ICON', this._getRandomEmoji());
        this._set(iter, 'NAME', 'foo');
        this._set(iter, 'TYPE', type);
        this._set(iter, 'Data', '');
        this._set(iter, 'ANGLE', -1);
      }

      this._builder.get_object('item-type-popover').popdown();
    });
  }

  // ----------------------------------------------------------------------- private stuff

  async _loadIcons() {
    const iconList = this._builder.get_object('icon-list');
    iconList.set_sort_column_id(-2, Gtk.SortType.ASCENDING);

    const iconTheme = Gtk.IconTheme.get_default();
    const icons     = iconTheme.list_icons(null);
    const batchSize = 10;
    for (let i = 0; i < icons.length; i += batchSize) {
      for (let j = 0; j < batchSize && i + j < icons.length; j++) {
        iconList.set_value(iconList.append(null), 0, icons[i + j]);
      }
      await new Promise(r => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1, r));
    }

    iconList.set_sort_column_id(0, Gtk.SortType.ASCENDING);
  }

  _deleteSelected() {
    if (!this._selection.get_selected()[0]) {
      return;
    }

    const dialog = new Gtk.MessageDialog({
      transient_for: this._builder.get_object('main-notebook').get_toplevel(),
      modal: true,
      buttons: Gtk.ButtonsType.OK_CANCEL,
      message_type: Gtk.MessageType.QUESTION,
      text: 'Do you really want to delete the selected item?',
      secondary_text: 'This cannot be undone!'
    });

    dialog.connect('response', (dialog, id) => {
      utils.notification(id + ' ' + Gtk.ResponseType.OK);
      if (id == Gtk.ResponseType.OK) {
        const [ok, model, iter] = this._selection.get_selected();
        if (ok) {
          model.remove(iter);
        }
      }
      dialog.destroy();
    });

    dialog.show();
  }

  _isToplevel(iter) {
    return this._store.get_path(iter).get_depth() <= 1;
  }

  _isToplevelSelected() {
    const [ok, model, iter] = this._selection.get_selected();
    if (ok) {
      return model.get_path(iter).get_depth() <= 1;
    }
    return false;
  }

  _get(iter, columnName) {
    return this._store.get_value(iter, this._store.columns[columnName]);
  }

  _set(iter, columnName, data) {
    this._store.set_value(iter, this._store.columns[columnName], data);

    if (columnName == 'ICON') {
      let iconSize = this._isToplevel(iter) ? 24 : 16;
      this._set(iter, 'DISPLAY_ICON', utils.createIcon(data, iconSize));
    }

    if (columnName == 'ANGLE') {
      this._set(iter, 'DISPLAY_ANGLE', data >= 0 ? data : '');
    }

    if (columnName == 'NAME') {
      if (this._isToplevel(iter)) {
        const hotkey = this._get(iter, 'DATA');
        this._set(iter, 'DISPLAY_NAME', '<b>' + data + '</b>\n' + hotkey);
      } else {
        this._set(iter, 'DISPLAY_NAME', data);
      }
    }

    if (columnName == 'COUNT') {
      this._set(iter, 'DETAILS', 'Max Items: ' + data);
    }

    if (columnName == 'DATA') {
      if (this._isToplevel(iter)) {
        const name = this._get(iter, 'NAME');
        this._set(
            iter, 'DISPLAY_NAME', '<b>' + name + '</b>\n<small>' + data + '</small>');
      } else {
        this._set(iter, 'DETAILS', data);
      }
    }
  }

  _getSelected(columnName) {
    const [ok, model, iter] = this._selection.get_selected();
    if (ok) {
      return this._get(iter, columnName);
    }
  }

  _setSelected(columnName, data) {
    const [ok, model, iter] = this._selection.get_selected();
    if (ok) {
      this._set(iter, columnName, data);
    }
  }

  _getRandomEmoji() {
    let emojis = [
      ...'💾🐹💞😀🎂🌞🥇💗🌟🐣🔧🌍🐈🍩💕🦔🤣📝🥂💥😁🎉💖😎😛🐸🍕☕🍺🍰🗿'
    ];
    return emojis[Math.floor(Math.random() * (emojis.length + 0))];
  }
}