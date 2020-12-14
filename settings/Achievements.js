//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Cairo                    = imports.cairo;
const {Gtk, Pango, PangoCairo} = imports.gi;

const _ = imports.gettext.domain('flypie').gettext;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// The Achievements class encapsulates code required for the 'Achievements' page of the //
// settings dialog. It's not instantiated multiple times, nor does it have any public   //
// interface, hence it could just be copy-pasted to the settings class. But as it's     //
// quite decoupled as well, it structures the code better when written to its own file. //
//////////////////////////////////////////////////////////////////////////////////////////

var Achievements = class Achievements {

  // ------------------------------------------------------------ constructor / destructor

  constructor(builder, settings) {

    // Keep a reference to the builder and the settings.
    this._builder  = builder;
    this._settings = settings;

    this._settingsConnections = [];

    const gestureKey = 'stats-gesture-selections';
    const clickKey   = 'stats-click-selections';

    this._connectStatsLabel('stats-abortions');
    this._connectStatsLabel('stats-dbus-menus');
    this._connectStatsLabel('stats-settings-opened');

    this._settingsConnections.push(
        this._settings.connect('changed::stats-click-selections', () => {
          this._charts['clicks'].data = this._settings.get_value(clickKey).deep_unpack();
          this._updateChartData(this._charts['clicks']);
          this._redrawCharts();
        }));

    this._settingsConnections.push(
        this._settings.connect('changed::stats-gesture-selections', () => {
          this._charts['gestures'].data =
              this._settings.get_value(gestureKey).deep_unpack();
          this._updateChartData(this._charts['gestures']);
          this._redrawCharts();
        }));

    this._charts = {
      clicks: {
        name: _('Click Selections'),
        hoveredName: _('Level-%i Click Selections'),
        pieWidget: this._setupPieChart('clicks'),
        histogramWidgets: [
          this._setupHistogram('clicks', 1), this._setupHistogram('clicks', 2),
          this._setupHistogram('clicks', 3), this._setupHistogram('clicks', 4)
        ],
        data: this._settings.get_value(clickKey).deep_unpack(),
        sum: {total: 0, perLevel: []},
        max: {total: 0, perLevel: []}
      },
      gestures: {
        name: _('Gesture Selections'),
        hoveredName: _('Level-%i Gesture Selections'),
        pieWidget: this._setupPieChart('gestures'),
        histogramWidgets: [
          this._setupHistogram('gestures', 1), this._setupHistogram('gestures', 2),
          this._setupHistogram('gestures', 3), this._setupHistogram('gestures', 4)
        ],
        data: this._settings.get_value(gestureKey).deep_unpack(),
        sum: {total: 0, perLevel: []},
        max: {total: 0, perLevel: []}
      }
    };

    this._updateChartData(this._charts['clicks']);
    this._updateChartData(this._charts['gestures']);
    this._redrawCharts();
  }

  // This should be called when the settings dialog is closed. It disconnects handlers
  // registered with the Gio.Settings object.
  destroy() {
    this._settingsConnections.forEach(connection => {
      this._settings.disconnect(connection);
    });
  }

  // ----------------------------------------------------------------------- private stuff

  _updateChartData(charts) {
    charts.sum = {total: 0, perLevel: []};
    charts.max = {total: 0, perLevel: []};

    for (let i = 0; i < charts.data.length; i++) {
      let sum = 0;
      let max = 0;

      charts.data[i].forEach(v => {
        sum += v;
        max = Math.max(max, v)
      });

      charts.sum.perLevel.push(sum);
      charts.max.perLevel.push(max);
      charts.sum.total += sum;
      charts.max.total = Math.max(charts.max.total, max);
    }
  }

  _redrawCharts() {
    for (const type in this._charts) {
      this._charts[type].pieWidget.queue_draw();
      this._charts[type].histogramWidgets.forEach((h) => h.queue_draw());
    }
  }

  _setupPieChart(type) {

    const drawingArea = this._builder.get_object(type + '-pie-chart');

    drawingArea.connect('draw', (widget, ctx) => {
      const charts = this._charts[type];

      const bottomPadding = 20;

      const width  = widget.get_allocated_width();
      const height = widget.get_allocated_height() - bottomPadding;

      const maxSum =
          Math.max(this._charts['gestures'].sum.total, this._charts['clicks'].sum.total);
      const maxRadius = Math.min(width, height) / 2;
      const minRadius = 0.5 * maxRadius;
      const radius    = (charts.sum.total / maxSum) * (maxRadius - minRadius) + minRadius;

      Gtk.render_background(widget.get_style_context(), ctx, 0, 0, width, height);

      const fgColor = widget.get_style_context().get_color(Gtk.StateFlags.NORMAL);
      const font = widget.get_style_context().get_property('font', Gtk.StateFlags.NORMAL);
      font.set_weight(Pango.Weight.BOLD);

      const layout = PangoCairo.create_layout(ctx);
      layout.set_font_description(font);
      layout.set_alignment(Pango.Alignment.CENTER);
      layout.set_width(Pango.units_from_double(width));

      ctx.setSourceRGBA(fgColor.red, fgColor.green, fgColor.blue, fgColor.alpha);
      ctx.moveTo(0, height + 2);

      let text   = charts.name;
      let number = charts.sum.total;

      for (let i = 0; i < charts.histogramWidgets.length; i++) {
        if (charts.histogramWidgets[i]._hovered) {
          text   = charts.hoveredName.replace('%i', i + 1);
          number = charts.sum.perLevel[i];
        }
      }

      layout.set_text(text, -1);
      PangoCairo.show_layout(ctx, layout);

      layout.set_text(this._formatNumber(number), -1);
      font.set_absolute_size(Pango.units_from_double(24));
      font.set_weight(Pango.Weight.NORMAL);
      layout.set_font_description(font);

      const extents = layout.get_pixel_extents()[1];
      ctx.moveTo(0, (height - extents.height) / 2);

      PangoCairo.show_layout(ctx, layout);



      ctx.translate(width * 0.5, height * 0.5);
      const fxColor  = widget.get_style_context().get_color(Gtk.StateFlags.LINK);
      let startAngle = -0.5 * Math.PI;

      for (let i = 0; i < charts.data.length; i++) {
        const endAngle =
            startAngle + (charts.sum.perLevel[i] / charts.sum.total) * 2.0 * Math.PI;
        ctx.moveTo(
            Math.cos(startAngle) * radius * 0.9, Math.sin(startAngle) * radius * 0.9);

        let lineWidth = 8;

        if (charts.histogramWidgets[i]._hovered) {
          lineWidth = 12;
        }

        const alpha = 1.0 - i / charts.data.length;
        ctx.setSourceRGBA(fxColor.red, fxColor.green, fxColor.blue, alpha);
        ctx.arc(0, 0, radius * 0.9, startAngle, endAngle);
        ctx.setLineWidth(lineWidth);
        ctx.stroke();

        ctx.setSourceRGBA(fgColor.red, fgColor.green, fgColor.blue, fgColor.alpha);
        ctx.moveTo(Math.cos(startAngle) * radius, Math.sin(startAngle) * radius);
        ctx.lineTo(
            Math.cos(startAngle) * radius * 0.8, Math.sin(startAngle) * radius * 0.8);
        ctx.setLineWidth(1);
        ctx.stroke();

        startAngle = endAngle;
      }

      return false;
    });

    return drawingArea;
  }

  _setupHistogram(type, depth) {

    const drawingArea = this._builder.get_object(type + '-histogram-' + depth);

    drawingArea.connect('enter-notify-event', (widget) => {
      widget._hovered = true;
      this._redrawCharts();
    });

    drawingArea.connect('leave-notify-event', (widget) => {
      widget._hovered = false;
      this._redrawCharts();
    });

    drawingArea.connect('draw', (widget, ctx) => {
      const globalMax =
          Math.max(this._charts['gestures'].max.total, this._charts['clicks'].max.total);
      const charts    = this._charts[type];
      const histogram = charts.data[depth - 1];

      const fgColor = widget.get_style_context().get_color(Gtk.StateFlags.NORMAL);
      const fxColor = widget.get_style_context().get_color(Gtk.StateFlags.LINK);
      const font = widget.get_style_context().get_property('font', Gtk.StateFlags.NORMAL);
      font.set_absolute_size(Pango.units_from_double(9));


      const width  = widget.get_allocated_width();
      const height = widget.get_allocated_height();
      Gtk.render_background(widget.get_style_context(), ctx, 0, 0, width, height);



      const topPadding    = 10;
      const bottomPadding = 20;
      const leftPadding   = 15;
      const rightPadding  = 15;

      if (widget._hovered) {
        ctx.setSourceRGBA(fxColor.red, fxColor.green, fxColor.blue, 0.8);
      } else {
        ctx.setSourceRGBA(fgColor.red, fgColor.green, fgColor.blue, 0.4);
      }

      ctx.moveTo(leftPadding, height - bottomPadding);
      ctx.lineTo(width - rightPadding, height - bottomPadding);
      ctx.setLineWidth(1);
      ctx.stroke();

      if (widget._hovered) {
        ctx.setSourceRGBA(fxColor.red, fxColor.green, fxColor.blue, 0.2);
      } else {
        ctx.setSourceRGBA(fgColor.red, fgColor.green, fgColor.blue, 0.1);
      }

      const maxSeconds = 5;
      for (let i = 0; i <= maxSeconds; i++) {
        const gap = (width - leftPadding - rightPadding - 2) / maxSeconds;
        ctx.moveTo(leftPadding + i * gap + 1, topPadding);
        ctx.lineTo(leftPadding + i * gap + 1, height - bottomPadding + 3);
      }

      ctx.setLineWidth(0.5);
      ctx.stroke();

      if (widget._hovered) {
        ctx.setSourceRGBA(fxColor.red, fxColor.green, fxColor.blue, 0.8);
      } else {
        ctx.setSourceRGBA(fgColor.red, fgColor.green, fgColor.blue, 0.4);
      }

      for (let i = 0; i <= maxSeconds; i++) {
        const gap = (width - leftPadding - rightPadding - 2) / maxSeconds;
        ctx.moveTo(leftPadding + i * gap - 5, height - bottomPadding + 1);

        const layout = PangoCairo.create_layout(ctx);
        layout.set_font_description(font);
        layout.set_alignment(Pango.Alignment.CENTER);
        layout.set_text(i + 's', -1);
        PangoCairo.show_layout(ctx, layout);
      }



      if (globalMax > 0) {
        ctx.setSourceRGBA(fxColor.red, fxColor.green, fxColor.blue, fxColor.alpha);
        const barWidth = (width - leftPadding - rightPadding) / histogram.length;
        for (let i = 0; i < histogram.length; i++) {
          const barHeight =
              (histogram[i] / globalMax) * (height - bottomPadding - topPadding);
          ctx.moveTo((i + 0.5) * barWidth + leftPadding, height - bottomPadding);
          ctx.lineTo(
              (i + 0.5) * barWidth + leftPadding, height - bottomPadding - barHeight);
        }
        ctx.setLineWidth(barWidth - 2);
        ctx.stroke();
      }

      return false;
    });

    return drawingArea;
  }

  // Shows the current value stored in Fly-Pie's settings under the given key with a
  // label. The label must use the same key as ID in the glade file. Whenever the settings
  // value changes, the label's text is updated automatically.
  _connectStatsLabel(key) {
    this._builder.get_object(key).label =
        this._formatNumber(this._settings.get_uint(key).toString());

    // Update on change.
    this._settingsConnections.push(this._settings.connect('changed::' + key, () => {
      this._builder.get_object(key).label =
          this._formatNumber(this._settings.get_uint(key).toString());
    }));
  }

  // Tiny helper method which appends a 'k' to the given number if it's greater than 999.
  _formatNumber(number) {
    return number >= 1000 ? (number / 1000).toFixed(1) + 'k' : number.toString();
  }
}