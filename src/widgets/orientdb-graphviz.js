/**
 * @license OrientDB-GraphViz v0.0.1
 * (c) 2010-2014 Orient Technologies, Ltd.
 * License: MIT
 */
import '../styles/orientdb-graphviz.css';
let OrientGraph = (function () {

  var graph = {};

  function OGraph(elem, config, metadata, menuActions, edgeActions) {


    this.viewport = d3.select(elem);


    this.originElement = elem;
    this.svg;
    this.config = merge(config);


    this.config.width = $(elem).width();
    this.metadata = getMerger().extend({}, metadata);
    this.menuActions = menuActions;
    this.edgeActions = edgeActions;
    this.topics = {}
    this.vertices = {};
    this.edges = {}
    this.links = [];
    this.nodes = [];
    this.classesLegends = [];
    this.force = d3.layout.force();


    this.colors = createColors(this.metadata.classes);
    // this.colors = d3.scale.category20();
    var self = this;
    this.selected = null;
    this.dragNode = null;
    this.clusterClass = initClusterClass();
    this.classesInCanvas = {vertices: [], edges: []};


    this.changer = initChanger();

    function initClusterClass() {
      var ctoc = {};
      if (self.metadata) {
        if (self.metadata.classes) {
          self.metadata.classes.forEach(function (c) {
            c.isVertex = discoverVertex(c.name);
            c.clusters.forEach(function (cluster) {
              ctoc[cluster] = c;
            })
          });
        }
      }

      return ctoc;
    }

    function createColors(classes) {
      let val = classes.map((c) => hashCode(c.name));
      val.sort((a, b) => {
        return a - b;
      });
      let color = d3.scale.category20()
        .domain([val[0], val[val.length - 1]])
      classes.forEach((c) => {
        color(hash(c.name));
      })
      return color;
    }

    function hashCode(str) {
      var hash = 0;
      if (str.length == 0) return hash;
      for (let i = 0; i < str.length; i++) {
        let char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return hash;
    }

    function hash(cls) {
      return hashCode(cls);
    }

    function discoverVertex(clazz) {
      var sup = clazz;
      var iterator = clazz;
      while ((iterator = getSuperClazz(iterator)) != "") {
        sup = iterator;
      }
      return sup == 'V';
    }

    function getSuperClazz(clazz) {
      var metadata = self.metadata;

      var classes = metadata['classes'];
      var clazzReturn = "";
      for (var entry in classes) {
        var name = classes[entry]['name'];
        if (clazz == name) {
          clazzReturn = classes[entry].superClass;
          break;
        }
      }

      return clazzReturn;
    }

    function initChanger() {
      var change = [];
      change['display'] = function (clazz, prop, val) {
        if (!self.config.classes[clazz]) {
          self.config.classes[clazz] = {}
        }
        self.config.classes[clazz].display = val;
        d3.selectAll('g.vertex-' + clazz.toLowerCase())
          .selectAll('.vlabel-outside')
          .attr('class', 'vlabel-outside')
          .text(bindRealName);

        d3.selectAll('text.elabel-' + clazz.toLowerCase())
          .selectAll('textPath')
          .text(function (e) {
            return bindRealNameOrClazz(e.edge);
          });

      }

      change['displayExpression'] = function (clazz, prop, val) {
        if (!self.config.classes[clazz]) {
          self.config.classes[clazz] = {}
        }
        self.config.classes[clazz].displayExpression = val;
        d3.selectAll('g.vertex-' + clazz.toLowerCase())
          .selectAll('.vlabel-outside')
          .attr('class', 'vlabel-outside')
          .text(bindRealName);

        d3.selectAll('text.elabel-' + clazz.toLowerCase())
          .selectAll('textPath')
          .text(function (e) {
            return bindRealNameOrClazz(e.edge);
          });

      }
      change['displayColor'] = function (clazz, prop, val) {
        if (!self.config.classes[clazz]) {
          self.config.classes[clazz] = {}
        }
        self.config.classes[clazz].displayColor = val;
        d3.selectAll('g.vertex-' + clazz.toLowerCase())
          .selectAll('.vlabel-outside')
          .style("fill", function (d) {
            return bindColor(d, "displayColor");
          })

      }
      change['displayBackground'] = function (clazz, prop, val) {
        if (!self.config.classes[clazz]) {
          self.config.classes[clazz] = {}
        }
        self.config.classes[clazz].displayBackground = val;
        d3.selectAll('g.vertex-' + clazz.toLowerCase())
          .selectAll('rect.vlabel-outside-bbox')
          .style("fill", bindRectColor)
          .style("stroke", bindRectColor)
      }

      change['icon'] = function (clazz, prop, val) {
        if (!self.config.classes[clazz]) {
          self.config.classes[clazz] = {}
        }
        self.config.classes[clazz].icon = val;

        d3.selectAll('g.vertex-' + clazz.toLowerCase())
          .selectAll('.vlabel-icon')
          .attr('class', 'vlabel-icon vicon')
          .text(val)


      }
      change['iconSize'] = function (clazz, prop, val) {
        if (!self.config.classes[clazz]) {
          self.config.classes[clazz] = {}
        }

        self.config.classes[clazz].iconSize = val;
        d3.selectAll('g.vertex-' + clazz.toLowerCase())
          .selectAll('.vlabel-icon')
          .style("font-size", self.config.classes[clazz].iconSize || 30);

      }

      change['iconCss'] = function (clazz, prop, val) {
        if (!self.config.classes[clazz]) {
          self.config.classes[clazz] = {}
        }

        self.config.classes[clazz].iconCss = val;

      }
      change['iconVPadding'] = function (clazz, prop, val) {
        if (!self.config.classes[clazz]) {
          self.config.classes[clazz] = {}
        }

        self.config.classes[clazz].iconVPadding = val;

        d3.selectAll('g.vertex-' + clazz.toLowerCase())
          .selectAll('.vlabel-icon')
          .attr('y', function (d) {
            var iconPadding = self.getClazzConfigVal(getClazzName(d), "iconVPadding");
            return iconPadding || 10;
          })

      }
      change['strokeWidth'] = function (clazz, prop, val) {

        if (!self.config.classes[clazz]) {
          self.config.classes[clazz] = {}
        }

        self.config.classes[clazz].strokeWidth = val;

        d3.selectAll('path.edge-' + clazz.toLowerCase())
          .style('stroke-width', function (d) {
            return bindStrokeWidth(d.edge);
          })
      }
      var style = function (clazz, prop, val) {

        if (!self.config.classes[clazz]) {
          self.config.classes[clazz] = {}
        }
        self.config.classes[clazz][prop] = val;
        d3.selectAll('g.vertex-' + clazz.toLowerCase())
          .selectAll('.vcircle')
          .style(prop, val);

        d3.selectAll('g.legend-' + clazz.toLowerCase())
          .selectAll("circle")
          .style(prop, val);

        d3.selectAll('g.legend-' + clazz.toLowerCase())
          .selectAll("line")
          .style(prop, val);

        d3.selectAll('path.edge-' + clazz.toLowerCase())
          .style(prop, function (d) {
            return bindStroke(d.edge);
          })
      }
      change['fill'] = style;
      change['stroke'] = style;
      change['r'] = function (clazz, prop, val) {
        if (!self.config.classes[clazz]) {
          self.config.classes[clazz] = {}
        }
        self.config.classes[clazz][prop] = val;
        d3.selectAll('g.vertex-' + clazz.toLowerCase())
          .selectAll('.vcircle')
          .attr('r', bindRadius);

        self.setSelected(self.selected);

        d3.selectAll('g.vertex-' + clazz.toLowerCase())
          .selectAll('g.vlabel-outside-group')
          .attr('y', function (d) {
            return parseInt(bindRadius(d)) + 15;
          })


      }
      return change;
    }

    function merge(config) {
      return config ? getMerger().extend({}, OGraphDefaultConfig(), config) : OGraphDefaultConfig();
    }

    function getMerger() {
      return angular ? angular : $;
    }

    this.toggleLegend = function () {


      this.svgContainer.selectAll("g.legend-container").attr("class", function () {
        var cls = d3.select(this).attr("class");
        return cls.indexOf("hide") != -1 ? "legend-container" : "legend-container hide";
      })
      //var parent = d3.select(this.classesContainer.node().parentNode());
      //
      //console.log(parent);
      //var cls = parent.attr("class");
      //if (cls.indexOf("hide") != -1) {
      //  parent.attr("class", "legend-container");
      //} else {
      //  parent.attr("class", "legend-container hide");
      //}

    }
    this.fullScreen = function (full) {
      if (full) {
        var start = $(this.originElement).offset().top;
        var wHeight = $(document).height();
        var height = wHeight - start;
        this.svgContainer
          .attr('height', height)
      } else {
        this.svgContainer
          .attr('height', self.config.height)
      }

    }

    this.releasePhysicsInternal = function () {
      this.svgContainer.selectAll("g.vertex").classed("fixed", function (v) {
        return v.fixed = false
      })
    }

    this.freezePhysicsInternal = function () {
      this.svgContainer.selectAll("g.vertex").classed("fixed", function (v) {
        return v.fixed = true
      })
      this.force.stop();
    }

    this.resetZoomInternal = function () {
      var b = graphBounds();
      var w = b.X - b.x, h = b.Y - b.y;


      var bbox = this.svgContainer.node().getBoundingClientRect();
      var cw = bbox.width, ch = bbox.height;
      var s = Math.min(cw / w, ch / h);
      var tx = (-b.x * s + (cw / s - w) * s / 2), ty = (-b.y * s + (ch / s - h) * s / 2);

      this.svgContainer.transition()
        .duration(750)
        .call(this.zoomComponent.translate([tx, ty]).scale(s).event);

    }
    function graphBounds() {
      var x = Number.POSITIVE_INFINITY, X = Number.NEGATIVE_INFINITY, y = Number.POSITIVE_INFINITY, Y = Number.NEGATIVE_INFINITY;

      d3.selectAll("g.vertex").each(function (v) {
        x = Math.min(x, v.x - 100);
        X = Math.max(X, v.x + 100);
        y = Math.min(y, v.y - 300);
        Y = Math.max(Y, v.y + 300);
      });
      return {x: x, X: X, y: y, Y: Y};
    }

    this.addVertex = function (v) {
      if (!self.get[v["@rid"]]) {
        self.nodes.push(v);
        self.put([v["@rid"]], v);
      }
    }
    this.addEdge = function (e) {
      var v1 = e.right ? e.source : e.target;
      var v2 = e.right ? e.target : e.source;

      var id = v1["@rid"] + "_" + v2["@rid"];
      var count = self.edges[id];
      if (!count) {
        self.edges[id] = [];
      }
      var found = false;
      var l = e.label.replace("in_", "").replace("out_", "");

      if (l == "") l = "E";
      self.edges[id].forEach(function (e1) {
        var l1 = e1.label.replace("in_", "").replace("out_", "");
        if (l1 == "") l1 = "E";
        if (e1.source == e.source && e1.target == e.target && l == l1 && e.edge["@rid"] === e1.edge["@rid"]) {
          found = true;
        }
      })
      if (!found) {
        self.edges[id].push(e);
        self.links.push(e);
      }
    }

    this.setSelected = function (v) {
      var newSel = v != self.selected;
      self.selected = v;
      refreshSelected(newSel);
      self.edgeMenu.hide();
    }
    this.get = function (k) {
      return self.vertices[k];
    }
    this.put = function (k, v) {
      self.vertices[k] = v;
    }
    this.delete = function (k) {
      delete self.vertices[k];
    }
    this.clearGraph = function () {
      self.clearSelection();
      self.vertices = {};
      self.edges = {};
      self.classesInCanvas = {vertices: [], edges: []}
      self.edgesInCanvas = [];
      self.nodes.splice(0, self.nodes.length)
      self.links.splice(0, self.links.length)
    }
    this.simulate = function (forceTick) {

      var self = this;

      var mst = 100
      var mas = 60
      var mtct = 1000 / mas
      var now = function () {
        return Date.now();
      }

      var tick = this.force.tick;

      this.force.tick = function () {


        var startTick = now()
        var step = mst
        while (step-- && (now() - startTick < mtct)) {
          if (tick()) {
            mst = 2
            return true
          }
        }
        var rnd = Math.floor((Math.random() * 100) + 1);
        if (rnd % 2 == 0) {
          self.tick();
        }

        if (forceTick == true) {
          self.tick();
        }
        return false;
      }
    }

    this.init = function () {

      var self = this;
      this.force.nodes(this.nodes)
        .links(this.links)
        .size([this.config.width, this.config.height])
        .linkDistance(this.config.linkDistance)
        .linkStrength(0.1)
        .charge(this.config.charge)
        .friction(this.config.friction)


      this.svgContainer = this.viewport.append('svg');

      // define arrow markers for graph links
      this.svgContainer.append('svg:defs').append('svg:marker')
        .attr('id', 'end-arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 6)
        .attr('markerWidth', 3)
        .attr('markerHeight', 3)
        .attr('orient', 'auto')
        .append('svg:path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#000')
        .attr('class', 'end-arrow');

      this.svgContainer.append('svg:defs').append('svg:marker')
        .attr('id', 'start-arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 4)
        .attr('markerWidth', 3)
        .attr('markerHeight', 3)
        .attr('orient', 'auto')
        .append('svg:path')
        .attr('d', 'M10,-5L0,0L10,5')
        .attr('class', 'end-arrow');

      // define arrow markers for graph links
      this.svgContainer.append('svg:defs').append('svg:marker')
        .attr('id', 'end-arrow-hover')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 6)
        .attr('markerWidth', 3)
        .attr('markerHeight', 3)
        .attr('orient', 'auto')
        .append('svg:path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('class', 'end-arrow-hover');

      this.svgContainer.append('svg:defs').append('svg:marker')
        .attr('id', 'start-arrow-hover')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 4)
        .attr('markerWidth', 3)
        .attr('markerHeight', 3)
        .attr('orient', 'auto')
        .append('svg:path')
        .attr('d', 'M10,-5L0,0L10,5')
        .attr('fill', '#000')
        .attr('class', 'end-arrow-hover');


      this.svg = this.svgContainer
        .attr('width', "100%")
        .attr('height', "100%")
        .append("g");

      // line displayed when dragging new nodes
      this.drag_line = this.svg.append('svg:path')
        .attr('class', 'link dragline hidden')
        .attr('d', 'M0,0L0,0');


      this.svgContainer.on("click", function () {
        self.clearSelection();
        clearArrow();
      })
      this.svgContainer.on('mousemove', function () {

        if (!self.dragNode) return;
        // update drag line
        self.drag_line.attr('d', 'M' + self.dragNode.x + ',' + self.dragNode.y + 'L' + d3.mouse(self.svg.node())[0] + ',' + d3.mouse(self.svg.node())[1]);


      });
      this.circleSelected = this.svg.append('svg:g').append("svg:circle")
        .attr("class", "selected-vertex selected-vertex-none")
        .attr('r', this.getConfigVal("node").r + 3);

      this.classesContainer = this.svgContainer.append('svg:g')
        .attr("class", "legend-container")
        .attr("transform", function () {
          return "translate(" + (30) + ",30)";
        }).selectAll('g');


      this.edgesClassContainer = this.svgContainer.append('svg:g')
        .attr("class", "legend-edge-container")
        .attr("transform", function () {
          return "translate(" + (this.config.width - 120) + ",30)";
        }.bind(this)).selectAll('g');

      this.path = this.svg.append('svg:g').selectAll('g');
      this.circle = this.svg.append('svg:g').selectAll('g');

      if (self.menuActions) {
        this.menu = new OVertexMenu(this);
      }
      if (self.edgeActions) {
        this.edgeMenu = new OEdgeMenu(this);
      }

    }

    function clearArrow() {

      if (self.dragNode) {

        self.dragNode = null;
        self.drag_line
          .classed('hidden', true)
          .style('marker-end', '');
      }
    }

    function getClazzName(d) {
      if (d['@class']) {
        return d['@class'];
      }
      if (d.source['@class']) {
        return d.source['@class'];
      }
      else {
        var cluster = d["@rid"].replace("#", "").split(":")[0];
        var cfg = self.clusterClass[cluster];
        return cfg ? cfg.name : null;
      }
    }

    function bindClassName(d) {

      d.elem = this;
      var cname = getClazzName(d);
      var css = self.getClazzConfigVal(cname, "css");
      var cls = 'vertex ';
      if (cname) {
        cls += 'vertex-' + cname.toLowerCase();
      }
      return css ? cls + ' ' + css : cls;
    }


    function countRel(d) {
      var v1 = d.right ? d.source : d.target;
      var v2 = d.right ? d.target : d.source;

      var id = v1["@rid"] + "_" + v2["@rid"];
      var len = self.edges[id].length
      return len;
    }

    function countRelInOut(d) {
      var v1 = d.right ? d.source : d.target;
      var v2 = d.right ? d.target : d.source;

      var id = v1["@rid"] + "_" + v2["@rid"];
      var id1 = v2["@rid"] + "_" + v1["@rid"];
      var len = (self.edges[id] ? self.edges[id].length : 0 ) + (self.edges[id1] ? self.edges[id1].length : 0)
      return len;
    }


    function calculateRelPos(d) {
      var v1 = d.right ? d.source : d.target;
      var v2 = d.right ? d.target : d.source;

      var id = v1["@rid"] + "_" + v2["@rid"];

      return self.edges[id].indexOf(d);
    }

    function bindLabel(d) {

      // TO REMOVEe ?
      d.elem = this;
      var len = countRel(d);
      var replaced = d.label.replace("in_", "").replace("out_", "")
      return (replaced != "" ? replaced : "E");//+ ( len > 1 ? " (+" + (len - 1) + ")" : "");

    }

    this.clearSelection = function () {
      self.selected = null;
      self.menu.hide();
      self.edgeMenu.hide();
    }
    this.startEdgeCreation = function () {


      this.dragNode = self.selected;
      this.clearSelection();
      // reposition drag line
      this.drag_line
        .style('marker-end', 'url(#end-arrow)')
        .classed('hidden', false)
        .attr('d', 'M' + this.dragNode.x + ',' + this.dragNode.y + 'L' + this.dragNode.x + ',' + this.dragNode.y);

    }
    this.endEdgeCreation = function () {
      this.clearSelection();
      clearArrow();
      self.drag_line
        .classed('hidden', true)
        .style('marker-end', '');
    }

    this.isConnected = function (node1, node2) {


      if (node1["@rid"] === node2["@rid"])return true;
      var k1 = node1["@rid"] + "_" + node2["@rid"];
      var k2 = node2["@rid"] + "_" + node1["@rid"];
      return this.edges[k1] || this.edges[k2];
    }

    this.isInOrOut = function (node, edge) {

      return node["@rid"] === edge.source["@rid"] || node["@rid"] === edge.target["@rid"];
    }
    this.drawInternal = function () {

      var self = this;
      this.path = this.path.data(this.links);
      this.circle = this.circle.data(this.nodes, function (d) {
        return d['@rid'];
      });


      this.classesLegends.splice(0, this.classesLegends.length);
      this.classesLegends = this.classesInCanvas.vertices.concat(this.classesInCanvas.edges);


      if (this.classesContainerData) {
        this.classesContainerData.remove()
      }
      this.classesContainerData = this.classesContainer.data(this.classesLegends);


      this.clsLegend = this.classesContainerData.enter().append("svg:g").attr("class", function (d) {
        return "legend legend-" + d.toLowerCase();
      })


      // Vertex Class
      this.clsLegend.attr("transform", function (d, i) {
        return "translate(0," + 25 * i + ")";
      })


      this.clsLegend.append("circle")
        .attr("r", 10)
        .attr('y', function (d, i) {

        })
        .attr("class", function (d) {
          return self.classesInCanvas.vertices.indexOf(d) == -1 ? "elem-invisible" : "";
        })
        .style("fill", function (d) {
          var fill = self.getClazzConfigVal(d, "fill");
          return fill ? fill : null;
        })
        .style("stroke", function (d) {
          var stroke = self.getClazzConfigVal(d, "stroke");
          return stroke ? stroke : null;
        })

      this.clsLegend.append("line")
        .attr("x1", -10)
        .attr("x2", 10)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("class", function (d) {
          return self.classesInCanvas.edges.indexOf(d) == -1 ? "elem-invisible" : "";
        })
        .style("stroke-width", 5)
        .style("fill", function (d) {
          var fill = self.getClazzConfigVal(d, "fill");
          return fill ? fill : null;
        })
        .style("stroke", function (d) {
          var stroke = self.getClazzConfigVal(d, "stroke");
          return stroke ? stroke : null;
        })

      var txt = this.clsLegend.append("text")
        .attr("dy", 5)
        .text(function (d) {
          return d;
        })
      txt.each(function () {
        var diff = 15;
        d3.select(this).attr("dx", diff);

      });


      this.pathG = this.path.enter().append('svg:g').attr("class", function (d) {
        return 'edge-path';
      });

      this.edgePath = this.pathG.append('svg:path')
        .attr("class", function (d) {
          var eclass = d.edge ? "edge" : "edge lightweight"
          return eclass + " edge-" + d.label.toLowerCase();
        })
        .attr("id", function (d, i) {
          return "linkId_" + i;
        })
        .style('marker-start', function (d) {
          return d.left ? 'url(#start-arrow)' : '';
        })
        .style('marker-end', function (d) {
          return d.right ? 'url(#end-arrow)' : '';
        })

        .style('stroke', function (d) {
          return bindStroke(d.edge);
        })
        .style("stroke-width", function (d) {
          return bindStrokeWidth(d.edge);
        })


      this.pathG.append('svg:path')
        .attr("class", function (d) {
          return "path-overlay pointer";
        })
        .style('fill', "none")
        .style('stroke', function (d) {
          return bindStroke(d.edge);
        })
        .style("stroke-width", function (d) {
          return parseInt(bindStrokeWidth(d.edge)) + 15;
        })
        .on("mouseover", function (d) {

          d3.select(this).style("opacity", "0.3");
          //var eclass = d.edge ? "edge" : "edge lightweight"
          //eclass = eclass + " edge-hover edge-" + d.label.toLowerCase();
          //d3.select(this).attr("class", eclass)
          //  .style('marker-start', function (d) {
          //    return d.left ? 'url(#start-arrow-hover)' : '';
          //  }).style('marker-end', function (d) {
          //  return d.right ? 'url(#end-arrow-hover)' : '';
          //});
        })


        .on("mouseout", function (d) {

          d3.select(this).style("opacity", "0");
          //var eclass = d.edge ? "edge" : "edge lightweight"
          //eclass += " edge-" + d.label.toLowerCase();
          //d3.select(this).attr("class", eclass)
          //  .style('marker-start', function (d) {
          //    return d.left ? 'url(#start-arrow)' : '';
          //  }).style('marker-end', function (d) {
          //  return d.right ? 'url(#end-arrow)' : '';
          //});
        })
        .on("click", function (e) {
          d3.event.stopPropagation();

          var node = d3.select(this.parentNode).select("text.elabel").node();
          self.edgeMenu.select({elem: node, d: e})
          if (self.topics['edge/click']) {
            self.topics['edge/click'](e);
          }
        });


      this.pathG.append('svg:text')
        .attr("class", function (d) {
          var cls = getClazzName(d.edge);
          var clsEdge = cls ? cls.toLowerCase() : "-e";
          return "elabel elabel-" + clsEdge;
        })

        .style("text-anchor", "middle")
        .attr("dy", "-8")
        .append("textPath")
        .attr("startOffset", "50%")
        .attr("xlink:href", function (d, i) {
          return "#linkId_" + i;
        })
        .text(function (e) {
          return bindRealNameOrClazz(e.edge);
        }).on("click", function (e) {
        d3.event.stopPropagation();
        self.edgeMenu.select({elem: this, d: e})
        if (self.topics['edge/click']) {
          self.topics['edge/click'](e);
        }
      });

      this.path.exit().remove();


      var g = this.circle.enter().append('svg:g').attr('class', bindClassName);


      g.on('mouseover', function (v) {


        if (self.dragNode) {
          var r = bindRadius(v);
          r = parseInt(r);
          var newR = r + ((r * 20) / 100);
          d3.select(v.elem).selectAll('circle').attr('r', newR)
        }


        d3.selectAll("g.vertex").style("opacity", function (n) {
          return self.isConnected(v, n) ? 1 : 0.1;
        })

        d3.selectAll("g.menu").style("opacity", function (n) {
          return 0.1;
        })
        d3.selectAll("path.edge").style("opacity", function (edge) {
          return self.isInOrOut(v, edge) ? 1 : 0.1;
        });
        d3.selectAll("text.elabel").style("opacity", function (edge) {
          return self.isInOrOut(v, edge) ? 1 : 0.1;
        });
      });


      g.on('mouseout', function (v) {
        if (self.dragNode) {
          d3.select(v.elem).selectAll('circle').attr('r', bindRadius);
        }


        if (!d3.select(this).classed("dragging")) {
          d3.selectAll("g.vertex").style("opacity", function (n) {
            return 1;
          })
          d3.selectAll("g.menu").style("opacity", function (n) {
            return 1;
          })
          d3.selectAll("path.edge").style("opacity", function (n) {
            return 1;
          });
          d3.selectAll("text.elabel").style("opacity", function (n) {
            return 1;
          });
        }
      })

      var drag = this.force.drag();

      drag.on("dragstart", function (v) {
        d3.event.sourceEvent.stopPropagation();
        d3.select(this).classed("dragging", true);
        d3.select(this).classed("fixed", v.fixed = true);
      })
      drag.on("dragend", function (v) {
        d3.event.sourceEvent.stopPropagation();
        d3.select(this).classed("dragging", false);
        //d3.select(this).classed("fixed", v.fixed = false);
      })
      g.call(drag);
      var cc = clickcancel();

      g.on('dblclick', function () {
        d3.event.stopPropagation();
      });
      g.call(cc);

      g.on('click', function (v) {

        if (self.dragNode && self.topics['edge/create']) {
          self.topics['edge/create'](self.dragNode, v);
          d3.event.stopPropagation();
          self.dragNode = null;
          d3.select(v.elem).selectAll('circle').attr('r', bindRadius);
        }
      })
      cc.on('click', function (e, v) {

        if (self.topics['node/click']) {
          if (v.loaded) {
            self.topics['node/click'](v);
          } else {
            if (self.topics['node/load']) {
              self.topics['node/load'](v, function (res) {
                if (self.isVertex(res)) {
                  v.loaded = true;
                  v.source = res;
                  d3.select(v.elem).attr('class', bindClassName);
                  d3.select(v.elem).selectAll('circle')
                    .attr('stroke-dasharray', bindDashArray)
                    .attr('fill-opacity', bindOpacity)
                    .attr('r', bindRadius);
                  self.topics['node/click'](v);
                }
              });
            }
          }
          self.setSelected(v);
        }

      });
      cc.on('dblclick', function (e, v) {

        if (self.topics['node/dblclick']) {

          self.topics['node/dblclick'](v);

        }
      });
      g.append('svg:circle')
        .attr('class', "vcircle")
        .attr('r', bindRadius)
        .attr('stroke-dasharray', bindDashArray)
        .attr('fill-opacity', bindOpacity)
        .style('fill', bindFill)
        .style('stroke', bindStroke);


      g.append('svg:text')
        .attr('x', 0)
        .attr('y', function (d) {
          var iconPadding = self.getClazzConfigVal(getClazzName(d), "iconVPadding");
          return iconPadding || 10;
        })
        .attr('class', function (d) {
          var name = self.getClazzConfigVal(getClazzName(d), "icon");
          return 'vlabel-icon vicon' + (!name ? ' elem-invisible' : '')
          bind;
        })
        .style("font-size", function (d) {
          var size = self.getClazzConfigVal(getClazzName(d), "iconSize");
          return size || 30;
        })
        .text(bindIcon);


      var group = g.append("g");
      group.attr('class', "vlabel-outside-group");

      function bindBboxPos(prop) {
        return function (elem) {
          var node = d3.select(this.parentNode)
            .selectAll('text.vlabel-outside')
            .node();
          var bbox = node.getBBox();
          return bbox[prop];
        }
      }


      group.append('svg:text')
        .attr('x', 0)
        .attr('y', function (d) {
          return parseInt(bindRadius(d)) + 15;
        })
        .attr('class', function (d) {
          return 'vlabel-outside';
        })
        .style("fill", function (d) {
          return bindColor(d, "displayColor");
        })
        .text(bindRealName);

      group.append('rect')
        .attr('x', bindBboxPos("x"))
        .attr('y', bindBboxPos("y"))

        .attr('class', "vlabel-outside-bbox")
        .attr('height', bindBboxPos("height"))
        .attr('width', bindBboxPos("width"))
        .style("fill-opacity", 0.5)
        .style("stroke-width", 1)
        .style("stroke", bindRectColor)
        .style("fill", bindRectColor)

      this.circle.exit().remove();
      this.zoomComponent = d3.behavior.zoom()
        .scaleExtent([0.005, 500])
        .on("zoom", this.zoom);

      this.svgContainer.call(this.zoomComponent);
    }

    function clickcancel() {
      var event = d3.dispatch('click', 'dblclick');

      function cc(selection) {
        var down,
          tolerance = 5,
          last,
          wait = null;
        // euclidean distance
        function dist(a, b) {
          return Math.sqrt(Math.pow(a[0] - b[0], 2), Math.pow(a[1] - b[1], 2));
        }


        selection.on('mousedown', function () {
          down = d3.mouse(document.body);
          last = +new Date();
        });
        selection.on('mouseup', function (v) {
          if (dist(down, d3.mouse(document.body)) > tolerance) {
            return;
          } else {

            if (wait) {
              window.clearTimeout(wait);
              wait = null;
              event.dblclick(d3.event, v);
            } else {
              wait = window.setTimeout((function (e) {
                return function () {
                  event.click(e, v);
                  wait = null;
                };
              })(d3.event), 300);
            }
          }
        });
      };
      return d3.rebind(cc, event, 'on');
    }

    function bindRadius(d) {

      var radius = self.getClazzConfigVal(getClazzName(d), "r");
      return radius ? radius : self.getConfigVal("node").r;
    }

    function bindOpacity(d) {
      if (!d.loaded) return '0.5';

      return "1";
    }

    function bindFill(d) {
      var clsName = getClazzName(d);
      var fill = self.getClazzConfigVal(clsName, "fill");
      if (!fill) {
        fill = d3.rgb(self.colors(hash(clsName))).toString();
        self.changeClazzConfig(clsName, "fill", fill);
      }
      return fill;
    }

    function bindStroke(d) {
      var clsName = getClazzName(d);
      var stroke = self.getClazzConfigVal(clsName, "stroke");
      if (!stroke) {

        stroke = d3.rgb(self.colors(hash(clsName))).darker().toString();

        self.changeClazzConfig(clsName, "stroke", stroke);
      }
      return stroke;

    }

    function bindColor(d, prop, def) {

      var clsName = getClazzName(d);
      var stroke = self.getClazzConfigVal(clsName, prop);
      if (!stroke) {
        var ret = def || "rgb(0, 0, 0)";
        return ret;
      }
      return stroke;

    }

    function bindStrokeWidth(d) {
      var clsName = getClazzName(d);
      var stroke = self.getClazzConfigVal(clsName, "strokeWidth");
      return stroke || 3;

    }

    function bindDashArray(d) {
      if (!d.loaded) return '5,5';
      return "0";
    }


    function bindRealName(d) {


      var name = self.getClazzConfigVal(getClazzName(d), "displayExpression");


      if (name && name !== "") {
        name = S(name).template(d.source);
      } else {
        name = self.getClazzConfigVal(getClazzName(d), "display", d.source);
      }
      var rid;
      if (d['@rid'].startsWith("#-")) {
        var props = Object.keys(d.source).filter(function (e) {
          return !e.startsWith("@");
        })
        rid = (props.length > 0 && d.source[props[0]]) ? d.source[props[0]] : d['@rid'];
      } else {
        rid = d['@rid'];
      }

      return name != null ? name : rid;
    }

    function bindRealNameOrClazz(d) {

      var clazz = getClazzName(d);

      var name = self.getClazzConfigVal(getClazzName(d), "displayExpression");

      if (name && name !== "") {
        name = S(name).template(d);
      } else {
        name = self.getClazzConfigVal(clazz, "display", d);
      }
      return name != null ? name : clazz;
    }

    function bindIcon(d) {

      var name = self.getClazzConfigVal(getClazzName(d), "icon");
      return name;
    }


    function calculateEdgePath(padding) {
      var d = d3.select(this.parentNode).datum();


      var radiusSource = self.getClazzConfigVal(getClazzName(d.source), "r");
      var radiusTarget = self.getClazzConfigVal(getClazzName(d.target), "r");

      radiusSource = radiusSource ? radiusSource : self.getConfigVal("node").r;
      radiusTarget = radiusTarget ? radiusTarget : self.getConfigVal("node").r;


      var padd = 5;

      radiusTarget = parseInt(radiusTarget);
      radiusSource = parseInt(radiusSource);
      var deltaX = d.target.x - d.source.x,
        deltaY = d.target.y - d.source.y,
        dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),


        normX = deltaX / (dist != 0 ? dist : 1),
        normY = deltaY / (dist != 0 ? dist : 1),
        sourcePadding = d.left ? (radiusSource + padd) : radiusSource,
        targetPadding = d.right ? (radiusTarget + padd) : radiusTarget,
        sourceX = d.source.x + (sourcePadding * normX),
        sourceY = d.source.y + (sourcePadding * normY),
        targetX = d.target.x - (targetPadding * normX),
        targetY = d.target.y - (targetPadding * normY);
      // Config Node - > Label


      var rel = countRelInOut(d);


      if (rel == 1) {
        return 'M' + sourceX + ',' + sourceY + ' L' + targetX + ',' + targetY;
      } else {

        var realPos = calculateRelPos(d);


        if (realPos == 0) {
          var paddingSource = 5;
          var paddingTarget = 5;
          if (deltaX > 0) {
            paddingSource = -1 * 5;
            paddingTarget = -1 * 5;
          }

          return 'M' + (sourceX + paddingSource) + ',' + (sourceY + paddingSource) + ' L' + (targetX + paddingTarget) + ',' + (targetY + paddingTarget);
        }
        var pos = realPos + 1;
        var m = (d.target.y - d.source.y) / (d.target.x - d.source.x);
        var val = (Math.atan(m) * 180) / Math.PI;
        var trans = val * (Math.PI / 180) * -1;
        var edgesLength = countRel(d);
        var radiansConfig = angleRadiants(pos, edgesLength);

        var angleSource;
        var angleTarget;
        var signSourceX;
        var signSourceY;
        var signTargetX;
        var signTargetY;

        if (deltaX < 0) {
          signSourceX = 1;
          signSourceY = 1;
          signTargetX = 1;
          signTargetY = 1;
          angleSource = radiansConfig.target - trans;
          angleTarget = radiansConfig.source - trans;
        } else {
          signSourceX = 1;
          signSourceY = -1;
          signTargetX = 1;
          signTargetY = -1;
          angleSource = radiansConfig.source + trans;
          angleTarget = radiansConfig.target + trans;
        }


        sourceX = d.source.x + ( signSourceX * (sourcePadding * Math.cos(angleSource)));
        sourceY = d.source.y + ( signSourceY * (sourcePadding * Math.sin(angleSource)));
        targetX = d.target.x + ( signTargetX * (targetPadding * Math.cos(angleTarget)));
        targetY = d.target.y + ( signTargetY * (targetPadding * Math.sin(angleTarget)));


        // var mod = dist / 10;
        // var dr = mod * rel;

        var dr = calculateDR(targetX - sourceX, targetY - sourceY, pos, edgesLength);

        return "M" + sourceX + "," + sourceY + "A" + dr + "," + dr + " 0 0,1 " + targetX + "," + targetY;
      }

    }


    function calculateDR(dx, dy, pos, length) {
      pos = length - pos;
      var dr = Math.sqrt(dx * dx + dy * dy);

      dr = dr / (1 + (1 / length) * (pos - 1));

      return dr / 2;

    }

    function angleRadiants(pos, length) {


      let sourceAngle = 90 - (90 / length) * pos;
      let targetAngle = (180 - ( 90 - (90 / length) * pos));

      return {source: sourceAngle * (Math.PI / 180), target: targetAngle * (Math.PI / 180)};

    }

    function bindRectColor(d) {
      var def = "rgba(0, 0, 0, 0)";
      var c = bindColor(d, "displayBackground", def);
      if (c == "#ffffff") {
        c = def;
      }
      return c;
    }

    function bindName(d) {

      var name = self.getClazzConfigVal(getClazzName(d), "icon");

      if (!name) {
        name = self.getClazzConfigVal(getClazzName(d), "display", d.source);
      }


      var rid;
      if (d['@rid'].startsWith("#-")) {

        var props = Object.keys(d.source).filter(function (e) {
          return !e.startsWith("@");
        })
        rid = (props.length > 0 && d.source[props[0]]) ? d.source[props[0]] : d['@rid'];
      } else {
        rid = d['@rid'];
      }

      return name != null ? name : rid;
    }

    this.changeClazzConfig = function (clazz, prop, val) {
      if (this.changer[prop])
        this.changer[prop](clazz, prop, val);
    }
    this.changeLinkDistance = function (distance) {
      this.force.linkDistance(distance);
      this.config.linkDistance = distance;
    }
    this.getClazzConfigVal = function (clazz, prop, obj) {
      if (!clazz || !prop) return null;


      if (self.config.classes && self.config.classes[clazz] && self.config.classes[clazz][prop]) {
        return obj ? obj[self.config.classes[clazz][prop]] : self.config.classes[clazz][prop];
      }
      return null;
    }
    this.getConfig = function () {
      return this.config;
    }
    this.getClazzConfig = function (clazz) {
      if (!self.config.classes) {
        self.config.classes = {};
      }
      if (!self.config.classes[clazz]) {
        self.config.classes[clazz] = {};
      }
      return getMerger().extend({}, self.config.classes[clazz]);
    }
    this.getConfigVal = function (prop) {
      return self.config[prop];
    }
    this.removeInternalVertex = function (v) {
      this.clearSelection();
      var idx = self.nodes.indexOf(v);
      self.nodes.splice(idx, 1);
      var toSplice = self.links.filter(function (l) {
        return (l.source === v || l.target === v);
      });
      toSplice.map(function (l) {
        self.links.splice(self.links.indexOf(l), 1);
      });

    }
    this.removeInternalEdge = function (e) {
      var idx = self.links.indexOf(e);
      self.links.splice(idx, 1);
      this.clearSelection();

      //d3.select(e.elem).remove();
    }
    this.zoom = function () {

      var scale = d3.event.scale;
      var translation = d3.event.translate;
      self.svg.attr("transform", "translate(" + translation + ")" +
        " scale(" + scale + ")");
    }
    function refreshSelected(change) {


      if (self.selected) {
        var selR = parseInt(bindRadius(self.selected));
        self.menu.refreshPosition(selR, change);

      }
    }

    this.tick = function () {

      var path = self.path.selectAll("path.edge");

      path.attr('d', calculateEdgePath);

      var overlay = self.path.selectAll("path.path-overlay");

      overlay.attr('d', function () {
        return calculateEdgePath.bind(this)(0);
      });


      if (self.edgeMenu) {
        self.edgeMenu.refreshPosition();
      }
      self.circle.attr('transform', function (d) {
        return 'translate(' + d.x + ',' + d.y + ')';
      });
      // refreshSelected();
    }

    this.isVertex = function (elem) {
      if (typeof elem == 'object') {
        return !(elem['in'] && elem['out']) && elem['@rid'];
      } else {
        var cid = elem.replace("#", "").split(":")[0];
        var cfg = self.clusterClass[cid];

        if (cfg) return cfg.isVertex;
      }
      return false;
    }
  }

  function ONodes(graph) {

  }

  function ORelationship(graph) {

  }

  function OEdge(graph, v1, v2, label, edge) {


    this.graph = graph;
    this.source = v1;
    this.target = v2;
    this.left = false;
    this.right = true;
    this.label = label;
    this.edge = edge;
  }

  function OVertex(graph, elem) {

    if (elem instanceof Object) {
      this["@rid"] = elem['@rid'];
      this.loaded = true;
    } else {
      this["@rid"] = elem;
      this.loaded = false;
    }
    this.source = elem;
    this.graph = graph;
  }

  function OEdgeMore(graph) {

    this.graph = graph;
    this.current = graph.svg.append('svg:g').attr("class", "edgeMore");
    this.currentData = null;
    var self = this;


    this.select = function (data, change) {


      if (self.currentData && change) {

        var eclass = self.currentData.d.edge ? "edge" : "edge lightweight"
        d3.select(self.currentData.elem.parentNode).select("path.edge").attr("class", eclass + " hide");
        d3.select(self.currentData.elem.parentNode).select("text.elabel").attr("class", "elabel hide");
      }
      self.currentData = data;
      this.current.selectAll("*").remove();
      var sourceData = data;
      var d = data.d;


      var v1 = d.right ? d.source : d.target;
      var v2 = d.right ? d.target : d.source;

      var id = v1["@rid"] + "_" + v2["@rid"];

      var child = self.graph.edges[id].filter(function (e, i) {
        return i > 0;
      });


      var eclass = data.d.edge ? "edge" : "edge lightweight"
      eclass += change ? "" : " edge-hover"
      eclass += " edge-" + data.d.label.toLowerCase();
      d3.select(data.elem.parentNode).selectAll("path.edge").attr("class", eclass);
      d3.select(data.elem).attr("class", "elabel");
      var width = 100 * child.length;
      this.tree = d3.layout.tree().size([50, 50]);
      var data = {name: "", children: child, x: 0, y: 0, root: true}
      var nodes = this.tree.nodes(data);
      var links = this.tree.links(nodes);

      // Edges between nodes as a <path class="link" />
      var link = d3.svg.diagonal()
        .projection(function (d) {
          return [d.y, d.x];
        });
      this.current.selectAll("path.emore-link")
        .data(links)
        .enter()
        .append("svg:path")
        .attr("class", "emore-link")
        .attr("d", link);

      var nodeGroup = this.current.selectAll("g.emore")
        .data(nodes)
        .enter()
        .append("svg:g")
        .attr("class", function (d) {
          return d.root ? "emore root" : "emore"
        })
        .attr("transform", function (d) {
          return "translate(" + d.y + "," + d.x + ")";
        });


      var texts = nodeGroup.append("svg:text")
        .attr("text-anchor", function (d) {
          return d.children ? "end" : "start";
        })
        .attr("class", "more-text")
        .attr("dy", 5)
        .attr("dx", 1)
        .text(function (d) {
          return d.label ? d.label.replace("in_", "").replace("out_", "") : null;
        }).on("click", function (d) {


          var v1 = d.right ? d.source : d.target;
          var v2 = d.right ? d.target : d.source;
          var idx = v1["@rid"] + "_" + v2["@rid"];
          var index = self.graph.edges[idx].indexOf(d);
          self.graph.edges[idx].splice(index, 1);
          self.graph.edges[idx].unshift(d);
          self.select({elem: d.elem, d: d}, true);
          self.refreshPosition();
        });
      nodeGroup.insert("rect", "text")
        .attr("x", function (d) {
          return d3.select(this.parentNode).selectAll("text").node().getBBox().x;
        })
        .attr("y", function (d) {
          return d3.select(this.parentNode).selectAll("text").node().getBBox().y;
        })
        .attr("width", function (d) {
          return d3.select(this.parentNode).selectAll("text").node().getBBox().width + 2;
        })
        .attr("height", function (d) {
          return d3.select(this.parentNode).selectAll("text").node().getBBox().height + 2;
        })
        .attr("class", "more-text-container");

    }
    this.clear = function () {
      if (this.current) this.current.remove();
    }

    this.refreshPosition = function () {

      self.current.attr("transform", function () {
        if (self.currentData) {
          var data = self.currentData;

          var d = data.d;
          var bb = data.elem.getBBox();
          var m = (d.target.y - d.source.y) / (d.target.x - d.source.x);
          var x = (d.target.x + d.source.x) / 2;
          var y = (d.target.y + d.source.y) / 2;
          var val = (Math.atan(m) * 180) / Math.PI;
          val += 270;

          var text = d3.select(this).selectAll("text")
            .attr("transform", function (data) {
              return 'rotate( ' + ( +0) + ')';
            })
          var text = d3.select(this).selectAll("rect")
            .attr("transform", function (data) {
              return 'rotate( ' + ( +0) + ')';
            })
          if (!isNaN(val)) {
            return 'rotate(' + val + ' ' + x + ' ' + y + ') translate(' + (x + (bb.height)) + ' ' + (y) + ')';
          }
        }
      });

    }


  }

  function OEdgeMenu(graph) {

    this.graph = graph;
    this.edgeContainer = graph.svg.append('svg:g').attr("class", "edgeMenu hide")


    var width = 40 * graph.edgeActions.length;
    this.tree = d3.layout.tree().size([width, 50]);

    var data = {name: "", children: graph.edgeActions, x: 0, y: 0, root: true}
    var nodes = this.tree.nodes(data);
    var links = this.tree.links(nodes);

    // Edges between nodes as a <path class="link" />
    var link = d3.svg.diagonal()
      .projection(function (d) {
        return [d.y, d.x];
      });

    this.edgeContainer.selectAll("path.enode-link")
      .data(links)
      .enter()
      .append("svg:path")
      .attr("class", "enode-link")
      .attr("d", link);


    var nodeGroup = this.edgeContainer.selectAll("g.enode")
      .data(nodes)
      .enter()
      .append("svg:g")
      .attr("class", "enode")
      .attr("transform", function (d) {
        return "translate(" + d.y + "," + d.x + ")";
      });

    var circle = nodeGroup.append("svg:circle")
      .attr("class", function (d) {
        return d.root ? "enode-root" : "enode-child";
      })
      .attr("r", 15);

    var texts = nodeGroup.append("svg:text")
      .attr("text-anchor", function (d) {
        return d.children ? "end" : "start";
      })

      .attr("dy", 5)
      .attr("dx", 1)
      .text(function (d) {
        return d.name;
      }).on("click", function (d) {
        if (d.onClick) {
          d3.event.stopPropagation();
          d.onClick(self.selectedEdge.d);
        }
      });

    var self = this;
    this.select = function (data) {
      var bb = data.elem.getBBox();
      self.selectedEdge = data;
      self.edgeContainer.attr("class", "edgeMenu")
      self.edgeContainer.datum({bbox: bb, edge: data.d, elem: data.elem});
      self.refreshPosition();
      self.graph.menu.hide();

    }

    this.hide = function () {
      self.edgeContainer.attr("class", "edgeMenu hide")
    }
    this.refreshPosition = function () {
      self.edgeContainer.attr("transform", function (data) {
        if (data) {
          var d = data.edge;
          var bb = data.bbox;

          var deltaX = d.target.x - d.source.x;
          var m = (d.target.y - d.source.y) / (d.target.x - d.source.x);
          var x = (d.target.x + d.source.x) / 2;
          var y = (d.target.y + d.source.y) / 2;
          var val = (Math.atan(m) * 180) / Math.PI;
          val += 90 * (deltaX < 0 ? 1 : -1);
          texts.attr("transform", function (data) {
            return 'rotate( ' + ( -val) + ')';
          })
          if (!isNaN(val)) {
            var offsetX = -bb.width;
            var offsetY = -bb.height;
            if (deltaX < 0) {
              var offsetX = bb.height / 2;
              var offsetY = -bb.width;
            }
            return 'rotate(' + val + ' ' + bb.x + ' ' + bb.y + ') translate(' + (bb.x + offsetX  ) + ' ' + (bb.y + offsetY ) + ')';
          }
        }
      });
    }
  }

  function OVertexMenu(graph) {
    this.graph = graph;
    this.menuContainer = graph.svg.append("g");
    this.menuContainer.attr("class", "menu menu-hide");
    this.subSelected = null;


    this.pie = d3.layout.pie()
      .sort(null).value(function (d) {
        return 1;
      });
    this.arc = d3.svg.arc()
      .innerRadius(0)
      .outerRadius(0);

    var self = this;
    var menuSel = null;
    var menuGroup = this.menuContainer.selectAll("g")
      .data(this.pie(graph.menuActions))
      .enter()
      .append("g")
      .attr("class", "menu-entry")
      .on("click", function (d) {

        d3.event.stopPropagation();
        if (d.data.onClick)
          d.data.onClick(graph.selected);
      }).on("mouseover", function (d) {


        if (menuSel != null && menuSel != this) {
          d3.select(menuSel).selectAll("g.treemenu").remove();
          d3.select(menuSel).selectAll("g.submenu").remove();
        }
        menuSel = this;

        if (d.data.submenu) {

          if (d.data.submenu.entries instanceof Function) {
            var res = d.data.submenu.entries(graph.selected);
          } else {
            var res = d.data.submenu.entries;
          }
          if (d.data.submenu.type == 'tree') {


            if (!d3.select(this).selectAll("g.treemenu").empty()) {
              if (self.subSelected == d)return;
            }
            self.subSelected = d;


            var height = 17 * res.length;
            var width = 50;
            var parent = d;

            var orientations = {
              "rtl": {
                size: [height, width],
                width: width,
                offset: -width * 2,
                x: function (d) {
                  return (width * 2) - d.y;
                },
                xoff: function (d) {
                  return (width) - d.y;
                },
                y: function (d) {
                  return d.x;
                }
              },
              "ltr": {
                size: [height, width],
                width: width,
                offset: 0,
                x: function (d) {
                  return d.y;
                },
                xoff: function (d) {
                  return d.y;
                },
                y: function (d) {
                  return d.x;
                }
              }
            };
            var orientation = (d.startAngle >= 0 && d.endAngle <= Math.PI) ? orientations["ltr"] : orientations["rtl"];


            var tree = d3.layout.tree().size(orientation.size);
            var coord = self.arc.centroid(d)
            var diagonal = d3.svg.diagonal()
              .projection(function (d) {
                return [d.y, d.x];
              });


            var i = 0;
            var data = {name: d.data.name, children: res, x0: coord[0], y0: coord[1], root: true}
            var nodes = tree.nodes(data).reverse();
            var links = tree.links(nodes);

            nodes.forEach(function (d) {
              d.y = d.depth * orientation.width;
            });


            var mcontainer = d3.select(this).append('g').attr("class", "treemenu");
            mcontainer.attr("transform", function (d) {
              return "translate(" + (coord[0] + orientation.offset) + "," + (coord[1] - (height / 2)) + ")";
            })
            var n = mcontainer.selectAll('g.treenode').data(nodes, function (d) {
              return d.id || (d.id = ++i);
            });

            var nodeEnter = n.enter().append("g")
              .attr("class", function (d) {
                return d.root ? "treenode-root" : "treenode";
              })
              .attr("transform", function (d) {
                return "translate(" + coord[1] + "," + coord[0] + ")";
              })


            var txt = nodeEnter.append("text")
              .attr("x", function (d) {
                return d.children || d._children ? -10 : 10;
              })
              .attr("dy", ".35em")
              .attr("text-anchor", function (d) {
                return d.children || d._children ? "end" : "start";
              })
              .text(function (d) {
                return d.name;
              })
              .style("fill-opacity", 1e-6)
              .on("click", function (d) {
                d.onClick(graph.selected, d.label);
              });

            var bboxWidth = d3.select(txt.node().parentNode).node().parentNode.getBBox();
            var bbox = txt.node().getBBox();
            var padding = 2;
            nodeEnter.insert("rect", "text")
              .attr("x", bbox.x - padding)
              .attr("y", bbox.y - padding)
              .attr("width", bboxWidth.width + (padding * 2))
              .attr("height", bbox.height + (padding * 2))
              .attr("class", "tree-text-container");
            var nodeUpdate = n.transition()
              .duration(750)
              .attr("transform", function (d) {
                return "translate(" + orientation.xoff(d) + "," + orientation.y(d) + ")";
              });


            nodeUpdate.select("text")
              .style("fill-opacity", 1).attr("class", "tree-text-menu")

            var link = mcontainer.selectAll("path.treelink")
              .data(links, function (d) {
                return d.target.id;
              });

            // Enter any new links at the parent's previous position.
            link.enter().insert("path", "g")
              .attr("class", "treelink")
              .attr("d", function (d) {
                var o = {x: coord[0], y: coord[1]};
                return diagonal({source: o, target: o});
              });

            // Transition links to their new position.
            link.transition()
              .duration(750)
              .attr("d", d3.svg.diagonal().projection(function (d) {
                return [orientation.x(d), orientation.y(d)];
              }));

            // Transition exiting nodes to the parent's new position.


          } else {


            if (!d3.select(this).selectAll("g.submenu").empty()) {
              return;
            }
            var arcSub = d3.svg.arc()
              .innerRadius(d.innerRadius + 40)
              .outerRadius(d.innerRadius)
            var sEntry = d3.select(this).append("g").attr("class", "submenu");
            var entryGroup = sEntry.selectAll("g")
              .data(self.pie(res))
              .enter()
              .append("g")
              .attr("class", "submenu-entry")
              .on("click", function (sd) {
                d3.event.stopPropagation();
                if (sd.data.onClick)
                  sd.data.onClick(graph.selected, sd.data.name);
              })
            var submenu = entryGroup.append("path")
              .attr("fill", function (d, i) {
                return graph.colors(i);
              })
              .attr("d", arcSub)
              .attr("id", function (d, i) {
                return "subpath" + i;
              })
              .attr("class", "menu-path")

            var submenuText = entryGroup.append("text")
              .attr("class", "menu-text")
              .attr("transform", function (d) {
                return "translate(" + arcSub.centroid(d) + ")";
              })
              .attr("dy", ".35em")
              .text(function (d) {
                return d.data.name;
              })
          }
        }
      })
      .on("mouseout", function (d) {

      })

    this.menu = menuGroup.append("path")
      .attr("fill", function (d, i) {
        return graph.colors(i);
      })
      .attr("d", this.arc)
      .attr("class", "menu-path")

    this.menuText = menuGroup.append("text")
      .attr("class", "menu-text")
      .attr("transform", function (d) {
        return "translate(" + self.arc.centroid(d) + ")";
      })
      .attr("dy", ".35em")
      .text(function (d) {
        return d.data.name;
      })

    this.hide = function () {
      this.clearSubMenu();
      self.menuContainer.attr("class", "menu menu-hide");
    }
    this.clearSubMenu = function () {
      if (menuSel != null) {
        d3.select(menuSel).selectAll("g.treemenu").remove();
      }
    }
    this.refreshPosition = function (selR, change) {
      self.menuContainer.attr('transform', function () {

        return 'translate(' + graph.selected.x + ',' + graph.selected.y + ')';

      });

      self.menuContainer.attr("class", "menu");
      function tweenPie(b) {
        b.outerRadius = selR;
        b.innerRadius = selR + 40;

        var i = d3.interpolate({startAngle: 0, endAngle: 0, outerRadius: 0, innerRadius: 0}, b);
        return function (t) {
          return self.arc(i(t));
        };
      }

      self.arc.innerRadius(selR);
      self.arc.outerRadius(selR + 40);
      self.menu.attr("d", self.arc);
      if (change) {
        self.menu.transition()
          .ease("exp-out")
          .duration(500)
          .attr("d", self.arc)
          .each("end", function (d) {

          })
          .attrTween("d", tweenPie);

      }
      self.menuText.attr("transform", function (d) {
        return "translate(" + self.arc.centroid(d) + ")";
      })
    }
  }

  function checkInput(val) {

    if (!val) return false;
    if (typeof val == 'string' && val.indexOf("#") == 0) return true;
    if (typeof val == 'object' && checkInput(val['@rid'])) return true;
    return false;
  }


  function OGraphDefaultConfig() {

    return {
      width: 1200,
      height: 500,

      classes: {},
      node: {
        r: 30
      },
      linkDistance: 200,
      charge: -1000,
      friction: 0.9,
      gravity: 0.1
    }
  }

  graph.create = function (element, config, metadata, vertexActions, edgeActions) {
    return new OGraph(element, config, metadata, vertexActions, edgeActions);
  }


  OGraph.prototype = {


    on: function (event, cbk) {
      this.topics[event] = cbk;
      return this;
    },
    off: function (event) {
      this.topics[event] = null;
      return this;
    },


    data: function (data) {


      if (data) {

        if (data instanceof Array) {
          //this.dataArray(data);
        } else {
          var self = this;
          if (data.vertices) {
            data.vertices.forEach(function (elem) {
              var v = self.get(elem['@rid']);
              if (!v) {
                v = new OVertex(self, elem);
                self.addVertex(v);
              }
              if (elem["@class"]) {
                if (self.classesInCanvas.vertices.indexOf(elem["@class"]) == -1) {
                  self.classesInCanvas.vertices.push(elem["@class"]);
                }
              }
            })
          }
          if (data.edges) {
            data.edges.forEach(function (elem) {
              var v1 = self.get(elem['from']) || self.get(elem['out']);
              var v2 = self.get(elem['to']) || self.get(elem['in']);
              var e = new OEdge(self, v1, v2, elem['@class'], elem);
              self.addEdge(e);

              if (elem["@class"]) {
                if (self.classesInCanvas.edges.indexOf(elem["@class"]) == -1) {
                  self.classesInCanvas.edges.push(elem["@class"]);
                }
              }
            })
          }
        }
      }
      return this;
    },
    dataArray: function (data) {

      var self = this;
      self.lastDataSize = data.length;

      if (!self.tempEdge)
        self.tempEdge = {}
      data.forEach(function (elem) {


          if (self.isVertex(elem)) {

            if (!elem["@class"]) {
              elem["@class"] = "Unknown";
            }
            if (elem["@class"]) {
              if (self.classesInCanvas.indexOf(elem["@class"]) == -1) {
                self.classesInCanvas.push(elem["@class"]);
              }
            }
            var v = self.get(elem['@rid']);
            if (!v) {
              v = new OVertex(self, elem);
              self.addVertex(v);
            } else {
              if (!v.loaded) {
                v.source = elem;
                v.loaded = true;
              }
            }
            inspectVertex(elem, v);
          } else if (elem['in'] && elem['out']) {
            var v1 = self.get(elem['in']);
            if (!v1) {
              v1 = new OVertex(self, elem['in']);
              self.addVertex(v1);
              var cluster = elem["in"].replace("#", "").split(":")[0];
              var cfg = self.clusterClass[cluster];
              if (cfg) {
                if (self.classesInCanvas.indexOf(cfg.name) == -1) {
                  self.classesInCanvas.push(cfg.name);
                }
              }
            }
            var v2 = self.get(elem['out']);
            if (!v2) {
              v2 = new OVertex(self, elem['out']);
              self.addVertex(v2);
              var cluster = elem["out"].replace("#", "").split(":")[0];
              var cfg = self.clusterClass[cluster];
              if (cfg) {
                if (self.classesInCanvas.indexOf(cfg.name) == -1) {
                  self.classesInCanvas.push(cfg.name);
                }
              }
            }
            var e = new OEdge(self, v2, v1, elem['@class'], elem);
            self.addEdge(e);
          }

        }
      )

      var keys = Object.keys(self.tempEdge).filter(function (e) {
        return self.tempEdge[e].in && self.tempEdge[e].out;
      })
      keys.forEach(function (k) {
        var e = new OEdge(self, self.tempEdge[k].out, self.tempEdge[k].in, self.tempEdge[k].rel, k);
        self.addEdge(e);
        delete self.tempEdge[k];
      })
      function inspectVertex(elem, v) {
        var keys = Object.keys(elem);
        keys.forEach(function (k) {
          if (elem[k] instanceof Array) {
            elem[k].forEach(function (rid) {
                if (checkInput(rid)) {

                  if (typeof rid == 'object') {
                    if (self.isVertex(rid)) {
                      var v1 = self.get(rid['@rid']);
                      if (!v1) {
                        v1 = new OVertex(self, rid);
                        self.addVertex(v1);
                        inspectVertex(rid, v1);
                      }
                      var e = new OEdge(self, v, v1, k);
                      self.addEdge(e);
                    } else {
                      var v1 = self.get(rid['in']);
                      if (!v1) {
                        v1 = new OVertex(self, rid['in']);
                        self.addVertex(v1);
                      }
                      var v2 = self.get(rid['out']);
                      if (!v2) {
                        v2 = new OVertex(self, rid['out']);
                        self.addVertex(v2);
                      }

                      var e = new OEdge(self, v1, v2, k, rid);
                      self.addEdge(e);
                    }
                  } else {
                    if (self.isVertex(rid)) {
                      var v1 = self.get(rid);
                      if (!v1) {
                        return;
                      }
                      var cluster = rid.replace("#", "").split(":")[0];
                      var cfg = self.clusterClass[cluster];
                      if (cfg) {
                        if (self.classesInCanvas.indexOf(cfg.name) == -1) {
                          self.classesInCanvas.push(cfg.name);
                        }
                      }
                      if (k.startsWith('in_')) {
                        var e = new OEdge(self, v1, v, k);
                      } else {
                        var e = new OEdge(self, v, v1, k);
                      }
                      self.addEdge(e);
                    } else {
                      var edge = self.tempEdge[rid];
                      if (!edge) {
                        edge = {}
                      }
                      if (k.startsWith('in_')) {
                        edge.in = v;

                      } else {
                        edge.out = v;
                      }
                      edge.rel = k
                      self.tempEdge[rid] = edge;
                    }

                  }


                }
              }
            )
          } else {

          }
        });
      }

      return this;
    },
    removeVertex: function (v) {
      this.removeInternalVertex(v);
      this.delete(v['@rid']);
      this.redraw();
    },
    removeEdge: function (e) {
      this.removeInternalEdge(e);
      this.redraw();
    },
    draw: function () {
      this.init();


      this.drawInternal();
      var radius = this.nodes.length * this.config.linkDistance / (Math.PI * 2)
      var center = {x: this.config.width / 2, y: this.config.height / 2}
      this.update(this.nodes, center, radius);

      this.simulate(true);

      this.force.start();


    },
    toggleLegend: function () {
      this.toggleLegendInternal();
    },
    update: function (nodes, center, radius) {
      var free = nodes.filter(function (e) {
        return !(e.x && e.y);
      })
      var len = free.length;
      free.forEach(function (e, i, arr) {
        e.x = center.x + radius * Math.sin(2 * Math.PI * i / len)
        e.y = center.y + radius * Math.cos(2 * Math.PI * i / len)


      })
    },
    redraw: function () {

      this.drawInternal();
      this.clearSelection();
      var radius = this.nodes.length * this.config.linkDistance / (Math.PI * 2)
      var center = {x: this.config.width / 2, y: this.config.height / 2}
      this.update(this.nodes, center, radius)

      this.simulate();

      this.force.start();

      if (this.topics['data/changed']) {
        this.topics['data/changed'](this);
      }
    },
    startEdge: function () {
      this.startEdgeCreation();
    },
    selectNode: function (n) {
      this.setSelected(n);
    },
    endEdge: function () {
      this.endEdgeCreation();
    },
    clear: function () {
      this.clearGraph();
      this.redraw();
    },
    resetZoom: function () {
      this.resetZoomInternal();
    },
    freezePhysics: function () {
      this.freezePhysicsInternal();
    },
    releasePhysics: function () {
      this.releasePhysicsInternal();
    }
  }
  return graph;
})();

export  default OrientGraph;
