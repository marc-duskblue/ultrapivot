(function() {
    var callWithJQuery,
        extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
        hasProp = {}.hasOwnProperty, slice = [].slice;

    callWithJQuery = function(pivotModule) {
        if (typeof exports === "object" && typeof module === "object") {
            return pivotModule(require("jquery"));
        } else if (typeof define === "function" && define.amd) {
            return define(["jquery"], pivotModule);
        } else {
            return pivotModule(jQuery);
        }
    };

    callWithJQuery(function($) {

        $.fn.ultraPivot = function (input, inputOpts, locale) {
            var ultraRenderer = inputOpts.renderer;
            inputOpts.renderer = function (pvtData, opts) {
                ultraRenderer = ultraRenderer(pvtData, opts);
                return ultraRenderer.getTableElement();
            };
            this.pivot(input, inputOpts, locale);
            return ultraRenderer;
        };

        // An interface to create additional extensions over the core features
        $.ultraPivotUtils.UltraPivotExtension = function () {
            this.enabled = function (renderer) {};
        };

        $.ultraPivotUtils.extensions = {};
        $.ultraPivotUtils.registerExtension = function(extensionName, extension) {
            if (typeof extension === "function" && !$.ultraPivotUtils.extensions[extensionName]) {
                var test = new extension();
                if (test.enabled) {
                    $.ultraPivotUtils.extensions[extensionName] = extension;
                }
            }
        };

        function UltraPivotRenderer(pivotData, options) {
            var instance = this;
            var result, axisTable, colHeaderTable, rowHeaderTable, dataTable;
            var defaults = {
                table: {
                    clickCallback: null
                },
                localeStrings: {
                    totals: "Totals",
                    subtotalOf: "Subtotal of"
                },
                arrowCollapsed: "\u25B6",
                arrowExpanded: "\u25E2",
                rowSubtotalDisplay: {
                    displayOnTop: false,
                    disableFrom: 99999,
                    collapseAt: 99999,
                    hideOnExpand: false,
                    disableExpandCollapse: false
                },
                colSubtotalDisplay: {
                    displayOnTop: true,
                    disableFrom: 99999,
                    collapseAt: 99999,
                    hideOnExpand: false,
                    disableExpandCollapse: false
                },
                fontOptions: {
                    dataFont: {
                        fontStyle: 'normal',
                        fontWeight: 'normal',
                        fontFamily: 'Lato',
                        fontSize: 10
                    },
                    rowHeaderFont: {
                        fontStyle: 'normal',
                        fontWeight: 'bold',
                        fontFamily: 'Lato',
                        fontSize: 10
                    },
                    colHeaderFont: {
                        fontStyle: 'normal',
                        fontWeight: 'bold',
                        fontFamily: 'Lato',
                        fontSize: 10
                    }
                },
                theme: 'ultra-default-light',
                capabilities: ['table-highlight']
            };
            var opts, colAttrs, rowAttrs, rowKeys, colKeys, tree, rowTotals, colTotals, rowCount, colCount, allTotal, arrowExpanded, arrowCollapsed,
                capabilities, rowHeadersTree, colHeadersTree, dataScroller;

            var classRowHide = "rowhide";
            var classRowShow = "rowshow";
            var classColHide = "colhide";
            var classColShow = "colshow";
            var clickStatusExpanded = "expanded";
            var clickStatusCollapsed = "collapsed";
            var classExpanded = "expanded";
            var classCollapsed = "collapsed";
            var classRowExpanded = "rowexpanded";
            var classRowCollapsed = "rowcollapsed";
            var classColExpanded = "colexpanded";
            var classColCollapsed = "colcollapsed";
            var sizesInitialized = false;
            var activeExtensions = {};

            opts = $.extend(true, {}, defaults, options);
            if (opts.rowSubtotalDisplay.disableSubtotal) {
                opts.rowSubtotalDisplay.disableFrom = 0;
            }
            if (typeof opts.rowSubtotalDisplay.disableAfter !== 'undefined' && opts.rowSubtotalDisplay.disableAfter !== null) {
                opts.rowSubtotalDisplay.disableFrom = opts.rowSubtotalDisplay.disableAfter + 1;
            }
            if (typeof opts.rowSubtotalDisplay.collapseAt !== 'undefined' && opts.collapseRowsAt !== null) {
                opts.rowSubtotalDisplay.collapseAt = opts.collapseRowsAt;
            }
            if (opts.colSubtotalDisplay.disableSubtotal) {
                opts.colSubtotalDisplay.disableFrom = 0;
            }
            if (typeof opts.colSubtotalDisplay.disableAfter !== 'undefined' && opts.colSubtotalDisplay.disableAfter !== null) {
                opts.colSubtotalDisplay.disableFrom = opts.colSubtotalDisplay.disableAfter + 1;
            }
            if (typeof opts.colSubtotalDisplay.collapseAt !== 'undefined' && opts.collapseColsAt !== null) {
                opts.colSubtotalDisplay.collapseAt = opts.collapseColsAt;
            }
            var keyCount = function (obj) {
                var c = 0;
                for (var key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        c++;
                    }
                }
                return c;
            };

            colAttrs = pivotData.colAttrs;
            rowAttrs = pivotData.rowAttrs;
            rowKeys = pivotData.getRowKeys();
            colKeys = pivotData.getColKeys();
            tree = pivotData.tree;
            rowTotals = pivotData.rowTotals;
            colTotals = pivotData.colTotals;
            rowCount = keyCount(rowTotals);
            colCount = keyCount(colTotals);
            allTotal = pivotData.allTotal;
            arrowExpanded = opts.arrowExpanded;
            arrowCollapsed = opts.arrowCollapsed;
            capabilities = opts.capabilities;

            var enableCapability = function(capability) {
                if (!activeExtensions[capability]) {
                    var extension = $.ultraPivotUtils.extensions[capability];
                    if (!extension) return;
                    var extInstance = new extension();
                    extInstance.enabled(instance);
                    activeExtensions[capability] = extInstance;
                }
            };

            // Post render interactions
            this.getExtension = function (extensionName) {
                return activeExtensions[extensionName];
            };
            this.getTableElement = function () {
                return result ? result : main(rowAttrs, rowKeys, colAttrs, colKeys);
            };
            this.getOptions = function () {
                return opts;
            };
            this.setTheme = function (themeName) {
                $(result).removeClass(opts.theme);
                opts.theme = themeName;
                $(result).addClass(opts.theme);
            };

            /** Methods provide metadata*/
            this.getRowCount = function () {
                return rowCount;
            };
            this.getColCount = function () {
                return colCount;
            };
            this.getRowKeys = function () {
                return rowKeys;
            };
            this.getColKeys = function () {
                return colKeys;
            };
            this.getRowAttrs = function () {
                return rowAttrs;
            };
            this.getColAttrs = function () {
                return colAttrs;
            };
            this.getRowTotals = function () {
                return rowTotals;
            };
            this.getColTotals = function () {
                return colTotals;
            };
            this.getGrandTotal = function () {
                return allTotal;
            };
            this.getRowNode = function (rHeader) {
                var i, rh;
                for (i = 0; i < rowHeadersTree.length; i++) {
                    rh = rowHeadersTree[i];
                    if (rHeader === rh.th) {
                        return rh;
                    }
                }
                return null;
            };
            this.getColNode = function (cHeader) {
                var i, ch;
                for (i = 0; i < colHeadersTree.length; i++) {
                    ch = colHeadersTree[i];
                    if (cHeader === ch.th) {
                        return ch;
                    }
                }
                return null;
            };
            this.getChildren = function(h, type) {
                type = type ? type : 'data header total';
                var res = [],
                    header = type.indexOf('header') >= 0,
                    total = type.indexOf('total') >= 0,
                    data = type.indexOf('data') >= 0;

                collectChildren(h, header, total, data, res);
                return res;
            };
            this.getRowHeadersTree = function() {
                return rowHeadersTree;
            };
            this.getColHeadersTree = function() {
                return colHeadersTree;
            };
            this.scroll = function(a, b, c) {
                if (a || b || c) dataScroller.scroll(a, b, c);
                else return dataScroller.scroll();
            };

            var collectChildren = function (h, header, total, data, res) {
                var i, l, key, dt, children;
                if (!h) return;
                children = h.children;

                if (header) res.push($(h.th));
                if (total) {
                    if (h.sTh) res.push($(h.sTh));
                    if (h.dsTr) res.push($(h.dsTr).find('td'));
                    else res.push($(result).find('.dataTable').find('.col' + h.row + '.pvtColSubtotal'));
                }

                if (!children || children.length === 0) {
                    if (data) {
                        if (h.dtr) dt = $(h.dtr).find('td');
                        else dt = $(result).find('.dataTable').find('.col' + h.row);

                        if (!total) {
                            dt = dt.not('.pvtColSubtotal').not('.pvtRowSubtotal').not('.rowTotal').not('.colTotal');
                        }
                        res.push(dt);
                    }
                }
                else {
                    l = children.length;
                    for (i = 0; i < l; i++) {
                        key = children[i];
                        collectChildren(h[key], header, total, data, res);
                    }
                }
            };
            var hasClass = function(element, className) {
                var regExp;
                regExp = new RegExp("(?:^|\\s)" + className + "(?!\\S)", "g");
                return element.className.match(regExp) !== null;
            };
            var removeClass = function(element, className) {
                var k, len, name, ref, regExp, results;
                ref = className.split(" ");
                results = [];
                for (k = 0, len = ref.length; k < len; k++) {
                    name = ref[k];
                    regExp = new RegExp("(?:^|\\s)" + name + "(?!\\S)", "g");
                    results.push(element.className = element.className.replace(regExp, ''));
                }
                return results;
            };
            var addClass = function(element, className) {
                var k, len, name, ref, results;
                ref = className.split(" ");
                results = [];
                for (k = 0, len = ref.length; k < len; k++) {
                    name = ref[k];
                    if (!hasClass(element, name)) {
                        results.push(element.className += " " + name);
                    } else {
                        results.push(void 0);
                    }
                }
                return results;
            };
            var replaceClass = function(element, replaceClassName, byClassName) {
                removeClass(element, replaceClassName);
                return addClass(element, byClassName);
            };
            var createElement = function(elementType, className, textContent, attributes, eventHandlers) {
                var attr, e, event, handler, val;
                e = document.createElement(elementType);
                if (className != null) {
                    e.className = className;
                }
                if (textContent != null) {
                    e.textContent = textContent;
                }
                if (attributes != null) {
                    for (attr in attributes) {
                        if (!hasProp.call(attributes, attr)) continue;
                        val = attributes[attr];
                        e.setAttribute(attr, val);
                    }
                }
                if (eventHandlers != null) {
                    for (event in eventHandlers) {
                        if (!hasProp.call(eventHandlers, event)) continue;
                        handler = eventHandlers[event];
                        e.addEventListener(event, handler);
                    }
                }
                return e;
            };
            var processKeys = function(keysArr, className, opts) {
                var headers, lastIdx, row;
                lastIdx = keysArr[0].length - 1;
                headers = {
                    children: []
                };
                row = 0;
                keysArr.reduce((function(_this) {
                    return function(val0, k0) {
                        var col;
                        col = 0;
                        k0.reduce(function(acc, curVal, curIdx, arr) {
                            var i, k, key, node, ref;
                            if (!acc[curVal]) {
                                key = k0.slice(0, col + 1);
                                acc[curVal] = {
                                    row: row,
                                    col: col,
                                    descendants: 0,
                                    children: [],
                                    text: curVal,
                                    key: key,
                                    flatKey: key.join(String.fromCharCode(0)),
                                    firstLeaf: null,
                                    leaves: 0,
                                    parent: col !== 0 ? acc : null,
                                    th: createElement("th", className, curVal),
                                    childrenSpan: 0
                                };
                                acc.children.push(curVal);
                            }
                            if (col > 0) {
                                acc.descendants++;
                            }
                            col++;
                            if (curIdx === lastIdx) {
                                node = headers;
                                for (i = k = 0, ref = lastIdx - 1; 0 <= ref ? k <= ref : k >= ref; i = 0 <= ref ? ++k : --k) {
                                    if (!(lastIdx > 0)) {
                                        continue;
                                    }
                                    node[k0[i]].leaves++;
                                    if (!node[k0[i]].firstLeaf) {
                                        node[k0[i]].firstLeaf = acc[curVal];
                                    }
                                    node = node[k0[i]];
                                }
                                return headers;
                            }
                            return acc[curVal];
                        }, headers);
                        row++;
                        return headers;
                    };
                })(this), headers);
                return headers;
            };
            var buildAxisHeader = function(axisHeaders, col, attrs, opts) {
                var ah, arrow, hClass;
                ah = {
                    text: attrs[col],
                    expandedCount: 0,
                    expandables: 0,
                    attrHeaders: [],
                    clickStatus: clickStatusExpanded,
                    onClick: collapseAxis
                };
                arrow = arrowExpanded + " ";
                hClass = classExpanded;
                if (col >= opts.collapseAt) {
                    arrow = arrowCollapsed + " ";
                    hClass = classCollapsed;
                    ah.clickStatus = clickStatusCollapsed;
                    ah.onClick = expandAxis;
                }
                if (col === attrs.length - 1 || col >= opts.disableFrom || opts.disableExpandCollapse) {
                    arrow = "";
                }
                ah.th = createElement("th", "pvtAxisLabel " + hClass, "" + arrow + ah.text);
                if (col < attrs.length - 1 && col < opts.disableFrom && !opts.disableExpandCollapse) {
                    ah.th.onclick = function(event) {
                        event = event || window.event;
                        return ah.onClick(axisHeaders, col, attrs, opts);
                    };
                }
                axisHeaders.ah.push(ah);
                return ah;
            };
            var buildColAxisHeaders = function(rowAttrs, colAttrs, opts) {
                var ah, attr, axisHeaders, col, k, len;
                axisHeaders = {
                    collapseAttrHeader: collapseCol,
                    expandAttrHeader: expandCol,
                    ah: []
                };
                for (col = k = 0, len = colAttrs.length; k < len; col = ++k) {
                    attr = colAttrs[col];
                    ah = buildAxisHeader(axisHeaders, col, colAttrs, opts.colSubtotalDisplay);
                    ah.tr = createElement("tr");
                    ah.ctr = createElement("tr");
                    if (col === 0 && rowAttrs.length !== 0) {
                        ah.tr.appendChild(createElement("th", null, null, {
                            colspan: rowAttrs.length,
                            rowspan: colAttrs.length
                        }));
                    }
                    ah.tr.appendChild(ah.th);
                    axisTable.appendChild(ah.tr);
                    colHeaderTable.appendChild(ah.ctr);
                }
                return axisHeaders;
            };
            var buildRowAxisHeaders = function(rowAttrs, colAttrs, opts) {
                var ah, axisHeaders, col, k, ref, th;
                axisHeaders = {
                    collapseAttrHeader: collapseRow,
                    expandAttrHeader: expandRow,
                    ah: [],
                    tr: createElement("tr")
                };
                for (col = k = 0, ref = rowAttrs.length - 1; 0 <= ref ? k <= ref : k >= ref; col = 0 <= ref ? ++k : --k) {
                    ah = buildAxisHeader(axisHeaders, col, rowAttrs, opts.rowSubtotalDisplay);
                    axisHeaders.tr.appendChild(ah.th);
                }
                if (colAttrs.length !== 0) {
                    th = createElement("th");
                    axisHeaders.tr.appendChild(th);
                }
                axisTable.appendChild(axisHeaders.tr);
                return axisHeaders;
            };
            var getHeaderText = function(h, attrs, opts) {
                var arrow;
                arrow = " " + arrowExpanded + " ";
                if (h.col === attrs.length - 1 || h.col >= opts.disableFrom || opts.disableExpandCollapse || h.children.length === 0) {
                    arrow = "";
                }
                return "" + arrow + h.text;
            };
            var getSubtotalHeaderText = function(h) {
                return opts.localeStrings.subtotalOf ?  opts.localeStrings.subtotalOf + ' ' + h.text : '';
            };
            var buildColHeader = function(axisHeaders, attrHeaders, h, rowAttrs, colAttrs, node, opts) {
                var ah, chKey, k, len, ref, ref1;
                ref = h.children;
                for (k = 0, len = ref.length; k < len; k++) {
                    chKey = ref[k];
                    buildColHeader(axisHeaders, attrHeaders, h[chKey], rowAttrs, colAttrs, node, opts);
                }
                ah = axisHeaders.ah[h.col];
                ah.attrHeaders.push(h);
                h.node = node.counter;
                h.onClick = collapseCol;
                addClass(h.th, classColShow + " col" + h.row + " colcol" + h.col + " " + classColExpanded);
                h.th.setAttribute("data-colnode", h.node);
                if (h.children.length !== 0) {
                    h.th.colSpan = h.childrenSpan;
                }
                if (h.children.length === 0 && rowAttrs.length !== 0) {
                    h.th.rowSpan = 2;
                }
                h.th.textContent = getHeaderText(h, colAttrs, opts.colSubtotalDisplay);
                if (h.children.length !== 0 && h.col < opts.colSubtotalDisplay.disableFrom) {
                    ah.expandables++;
                    ah.expandedCount += 1;
                    if (!opts.colSubtotalDisplay.hideOnExpand) {
                        h.th.colSpan++;
                    }
                    if (!opts.colSubtotalDisplay.disableExpandCollapse) {
                        h.th.onclick = function(event) {
                            event = event || window.event;
                            return h.onClick(axisHeaders, h, opts.colSubtotalDisplay);
                        };
                    }
                    h.sTh = createElement("th", "pvtColLabelFiller " + classColShow + " col" + h.row + " colcol" + h.col + " " + classColExpanded, getSubtotalHeaderText(h));
                    h.sTh.setAttribute("data-colnode", h.node);
                    h.sTh.rowSpan = colAttrs.length - h.col;
                    if (opts.colSubtotalDisplay.hideOnExpand) {
                        replaceClass(h.sTh, classColShow, classColHide);
                    }
                    h[h.children[0]].tr.appendChild(h.sTh);
                }
                if ((ref1 = h.parent) != null) {
                    ref1.childrenSpan += h.th.colSpan;
                }
                h.clickStatus = clickStatusExpanded;
                ah.ctr.appendChild(h.th);
                h.tr = ah.ctr;
                attrHeaders.push(h);
                return node.counter++;
            };
            var buildRowTotalsHeader = function(tr, rowAttrs, colAttrs) {
                var th;
                th = createElement("th", "pvtTotalLabel rowTotal", opts.localeStrings.totals, {
                    rowspan: colAttrs.length === 0 ? 1 : colAttrs.length + (rowAttrs.length === 0 ? 0 : 1)
                });
                return tr.appendChild(th);
            };
            var buildRowHeader = function(axisHeaders, attrHeaders, h, rowAttrs, colAttrs, node, opts) {
                var ah, chKey, firstChild, k, len, ref, ref1;
                ref = h.children;
                for (k = 0, len = ref.length; k < len; k++) {
                    chKey = ref[k];
                    buildRowHeader(axisHeaders, attrHeaders, h[chKey], rowAttrs, colAttrs, node, opts);
                }
                ah = axisHeaders.ah[h.col];
                ah.attrHeaders.push(h);
                h.node = node.counter;
                h.onClick = collapseRow;
                if (h.children.length !== 0) {
                    firstChild = h[h.children[0]];
                }
                addClass(h.th, classRowShow + " row" + h.row + " rowcol" + h.col + " " + classRowExpanded);
                h.th.setAttribute("data-rownode", h.node);
                if (h.col === rowAttrs.length - 1 && colAttrs.length !== 0) {
                    h.th.colSpan = 2;
                }
                if (h.children.length !== 0) {
                    h.th.rowSpan = h.childrenSpan;
                }
                h.th.textContent = getHeaderText(h, rowAttrs, opts.rowSubtotalDisplay);
                h.tr = createElement("tr", "row" + h.row);
                h.dtr = createElement('tr', "row" + h.row);

                h.tr.appendChild(h.th);
                if (h.children.length === 0) {
                    rowHeaderTable.appendChild(h.tr);
                    dataTable.appendChild(h.dtr);
                } else {
                    rowHeaderTable.insertBefore(h.tr, firstChild.tr);
                    dataTable.insertBefore(h.dtr, firstChild.dtr);
                }
                if (h.children.length !== 0 && h.col < opts.rowSubtotalDisplay.disableFrom) {
                    ++ah.expandedCount;
                    ++ah.expandables;
                    if (!opts.rowSubtotalDisplay.disableExpandCollapse) {
                        h.th.onclick = function(event) {
                            event = event || window.event;
                            return h.onClick(axisHeaders, h, opts.rowSubtotalDisplay);
                        };
                    }
                    h.sTh = createElement("th", "pvtRowLabelFiller row" + h.row + " rowcol" + h.col + " " + classRowExpanded + " " + classRowShow, getSubtotalHeaderText(h));
                    if (opts.rowSubtotalDisplay.hideOnExpand) {
                        replaceClass(h.sTh, classRowShow, classRowHide);
                    }
                    h.sTh.setAttribute("data-rownode", h.node);
                    h.sTh.colSpan = rowAttrs.length - (h.col + 1) + (colAttrs.length !== 0 ? 1 : 0);
                    if (opts.rowSubtotalDisplay.displayOnTop) {
                        h.tr.appendChild(h.sTh);
                    } else {
                        h.th.rowSpan += 1;
                        h.sTr = createElement("tr", "row" + h.row);
                        h.dsTr = createElement("tr", "row" + h.row);
                        h.sTr.appendChild(h.sTh);
                        rowHeaderTable.appendChild(h.sTr);
                        dataTable.appendChild(h.dsTr);
                    }
                }
                if (h.children.length !== 0) {
                    h.th.rowSpan++;
                }
                if ((ref1 = h.parent) != null) {
                    ref1.childrenSpan += h.th.rowSpan;
                }
                h.clickStatus = clickStatusExpanded;
                attrHeaders.push(h);
                return node.counter++;
            };
            var getTableEventHandlers = function(value, rowKey, colKey, rowAttrs, colAttrs, opts) {
                var attr, event, eventHandlers, filters, handler, i, ref, ref1;
                if (!((ref = opts.table) != null ? ref.eventHandlers : void 0)) {
                    return;
                }
                eventHandlers = {};
                ref1 = opts.table.eventHandlers;
                for (event in ref1) {
                    if (!hasProp.call(ref1, event)) continue;
                    handler = ref1[event];
                    filters = {};
                    for (i in colAttrs) {
                        if (!hasProp.call(colAttrs, i)) continue;
                        attr = colAttrs[i];
                        if (colKey[i] != null) {
                            filters[attr] = colKey[i];
                        }
                    }
                    for (i in rowAttrs) {
                        if (!hasProp.call(rowAttrs, i)) continue;
                        attr = rowAttrs[i];
                        if (rowKey[i] != null) {
                            filters[attr] = rowKey[i];
                        }
                    }
                    eventHandlers[event] = function(e) {
                        return handler(e, value, filters, pivotData);
                    };
                }
                return eventHandlers;
            };
            var buildValues = function(colAttrHeaders, rowAttrHeaders, rowAttrs, colAttrs, opts) {
                var aggregator, ch, cls, k, l, len, len1, rCls, ref, results, rh, td, totalAggregator, tr, val;
                results = [];
                for (k = 0, len = rowAttrHeaders.length; k < len; k++) {
                    rh = rowAttrHeaders[k];
                    if (!(rh.col === rowAttrs.length - 1 || (rh.children.length !== 0 && rh.col < opts.rowSubtotalDisplay.disableFrom))) {
                        continue;
                    }
                    rCls = "pvtVal row" + rh.row + " rowcol" + rh.col + " " + classRowExpanded;
                    if (rh.children.length > 0) {
                        rCls += " pvtRowSubtotal";
                        rCls += opts.rowSubtotalDisplay.hideOnExpand ? " " + classRowHide : "  " + classRowShow;
                    } else {
                        rCls += " " + classRowShow;
                    }
                    tr = rh.dsTr ? rh.dsTr : rh.dtr;
                    for (l = 0, len1 = colAttrHeaders.length; l < len1; l++) {
                        ch = colAttrHeaders[l];
                        if (!(ch.col === colAttrs.length - 1 || (ch.children.length !== 0 && ch.col < opts.colSubtotalDisplay.disableFrom))) {
                            continue;
                        }
                        aggregator = (ref = tree[rh.flatKey][ch.flatKey]) != null ? ref : {
                            value: (function() {
                                return null;
                            }),
                            format: function() {
                                return "";
                            }
                        };
                        val = aggregator.value();
                        cls = " " + rCls + " col" + ch.row + " colcol" + ch.col + " " + classColExpanded;
                        if (ch.children.length > 0) {
                            cls += " pvtColSubtotal";
                            cls += opts.colSubtotalDisplay.hideOnExpand ? " " + classColHide : " " + classColShow;
                        } else {
                            cls += " " + classColShow;
                        }
                        td = createElement("td", cls, aggregator.format(val), {
                            "data-value": val,
                            "data-rownode": rh.node,
                            "data-colnode": ch.node
                        }, getTableEventHandlers(val, rh.key, ch.key, rowAttrs, colAttrs, opts));
                        tr.appendChild(td);
                    }
                    totalAggregator = rowTotals[rh.flatKey];
                    val = totalAggregator.value();
                    td = createElement("td", "pvtTotal rowTotal " + rCls, totalAggregator.format(val), {
                        "data-value": val,
                        "data-row": "row" + rh.row,
                        "data-rowcol": "col" + rh.col,
                        "data-rownode": rh.node
                    });
                    getTableEventHandlers(val, rh.key, [], rowAttrs, colAttrs, opts);
                    results.push(tr.appendChild(td));
                }
                return results;
            };
            var buildColTotalsHeader = function(rowAttrs, colAttrs) {
                var colspan, th, tr;
                tr = createElement("tr");
                colspan = rowAttrs.length + (colAttrs.length === 0 ? 0 : 1);
                th = createElement("th", "pvtTotalLabel colTotal", opts.localeStrings.totals, {
                    colspan: colspan
                });
                tr.appendChild(th);
                return tr;
            };
            var buildColTotals = function(tr, attrHeaders, rowAttrs, colAttrs, opts) {
                var clsNames, h, k, len, results, td, totalAggregator, val;
                results = [];
                for (k = 0, len = attrHeaders.length; k < len; k++) {
                    h = attrHeaders[k];
                    if (!(h.col === colAttrs.length - 1 || (h.children.length !== 0 && h.col < opts.colSubtotalDisplay.disableFrom))) {
                        continue;
                    }
                    clsNames = "pvtVal pvtTotal colTotal " + classColExpanded + " col" + h.row + " colcol" + h.col;
                    if (h.children.length !== 0) {
                        clsNames += " pvtColSubtotal";
                        clsNames += opts.colSubtotalDisplay.hideOnExpand ? " " + classColHide : " " + classColShow;
                    } else {
                        clsNames += " " + classColShow;
                    }
                    totalAggregator = colTotals[h.flatKey];
                    val = totalAggregator.value();
                    td = createElement("td", clsNames, totalAggregator.format(val), {
                        "data-value": val,
                        "data-for": "col" + h.col,
                        "data-colnode": "" + h.node
                    }, getTableEventHandlers(val, [], h.key, rowAttrs, colAttrs, opts));
                    results.push(tr.appendChild(td));
                }
                return results;
            };
            var buildGrandTotal = function(tr, rowAttrs, colAttrs, opts) {
                var td, totalAggregator, val;
                totalAggregator = allTotal;
                val = totalAggregator.value();
                td = createElement("td", "pvtGrandTotal", totalAggregator.format(val), {
                    "data-value": val
                }, getTableEventHandlers(val, [], [], rowAttrs, colAttrs, opts));
                tr.appendChild(td);
                return tr;
            };
            var collapseAxisHeaders = function(axisHeaders, col, opts) {
                var ah, collapsible, i, k, ref, ref1, results;
                collapsible = Math.min(axisHeaders.ah.length - 2, opts.disableFrom - 1);
                if (col > collapsible) {
                    return;
                }
                results = [];
                for (i = k = ref = col, ref1 = collapsible; ref <= ref1 ? k <= ref1 : k >= ref1; i = ref <= ref1 ? ++k : --k) {
                    ah = axisHeaders.ah[i];
                    replaceClass(ah.th, classExpanded, classCollapsed);
                    ah.th.textContent = " " + arrowCollapsed + " " + ah.text;
                    ah.clickStatus = clickStatusCollapsed;
                    results.push(ah.onClick = expandAxis);
                }
                return results;
            };
            var adjustAxisHeader = function(axisHeaders, col, opts) {
                var ah;
                ah = axisHeaders.ah[col];
                if (ah.expandedCount === 0) {
                    return collapseAxisHeaders(axisHeaders, col, opts);
                } else if (ah.expandedCount === ah.expandables) {
                    replaceClass(ah.th, classCollapsed, classExpanded);
                    ah.th.textContent = " " + arrowExpanded + " " + ah.text;
                    ah.clickStatus = clickStatusExpanded;
                    return ah.onClick = collapseAxis;
                }
            };
            var hideChildCol = function(ch) {
                $(dataTable).find("tr td[data-colnode=\"" + ch.node + "\"], th[data-colnode=\"" + ch.node + "\"]").removeClass(classColShow).addClass(classColHide);
                return $(colHeaderTable).find("tr td[data-colnode=\"" + ch.node + "\"], th[data-colnode=\"" + ch.node + "\"]").removeClass(classColShow).addClass(classColHide);
            };
            var collapseHiddenColSubtotal = function(h, opts) {
                $(dataTable).find("tr td[data-colnode=\"" + h.node + "\"], th[data-colnode=\"" + h.node + "\"]").removeClass(classColExpanded).addClass(classColCollapsed);
                $(colHeaderTable).find("tr td[data-colnode=\"" + h.node + "\"], th[data-colnode=\"" + h.node + "\"]").removeClass(classColExpanded).addClass(classColCollapsed);
                if (h.children.length !== 0) {
                    h.th.textContent = " " + arrowCollapsed + " " + h.text;
                }
                return h.th.colSpan = 1;
            };
            var collapseShowColSubtotal = function(h, opts) {
                $(dataTable).find("tr td[data-colnode=\"" + h.node + "\"], th[data-colnode=\"" + h.node + "\"]").removeClass(classColExpanded).addClass(classColCollapsed).removeClass(classColHide).addClass(classColShow);
                $(colHeaderTable).find("tr td[data-colnode=\"" + h.node + "\"], th[data-colnode=\"" + h.node + "\"]").removeClass(classColExpanded).addClass(classColCollapsed).removeClass(classColHide).addClass(classColShow);
                if (h.children.length !== 0) {
                    h.th.textContent = " " + arrowCollapsed + " " + h.text;
                }
                return h.th.colSpan = 1;
            };
            var collapseChildCol = function(ch, h) {
                var chKey, k, len, ref;
                ref = ch.children;
                for (k = 0, len = ref.length; k < len; k++) {
                    chKey = ref[k];
                    if (hasClass(ch[chKey].th, classColShow)) {
                        collapseChildCol(ch[chKey], h);
                    }
                }
                return hideChildCol(ch);
            };
            var collapseCol = function(axisHeaders, h, opts) {
                var chKey, colSpan, k, len, p, ref;
                colSpan = h.th.colSpan - 1;
                ref = h.children;
                for (k = 0, len = ref.length; k < len; k++) {
                    chKey = ref[k];
                    if (hasClass(h[chKey].th, classColShow)) {
                        collapseChildCol(h[chKey], h);
                    }
                }
                if (h.col < opts.disableFrom) {
                    if (hasClass(h.th, classColHide)) {
                        collapseHiddenColSubtotal(h, opts);
                    } else {
                        collapseShowColSubtotal(h, opts);
                    }
                }
                p = h.parent;
                while (p) {
                    p.th.colSpan -= colSpan;
                    p = p.parent;
                }
                h.clickStatus = clickStatusCollapsed;
                h.onClick = expandCol;
                axisHeaders.ah[h.col].expandedCount--;
                return adjustAxisHeader(axisHeaders, h.col, opts);
            };
            var showChildCol = function(ch) {
                $(dataTable).find("tr td[data-colnode=\"" + ch.node + "\"], th[data-colnode=\"" + ch.node + "\"]").removeClass(classColHide).addClass(classColShow);
                return $(colHeaderTable).find("tr td[data-colnode=\"" + ch.node + "\"], th[data-colnode=\"" + ch.node + "\"]").removeClass(classColHide).addClass(classColShow);
            };
            var expandHideColSubtotal = function(h) {
                $(dataTable).find("tr td[data-colnode=\"" + h.node + "\"], th[data-colnode=\"" + h.node + "\"]").removeClass(classColCollapsed + " " + classColShow).addClass(classColExpanded + " " + classColHide);
                $(colHeaderTable).find("tr td[data-colnode=\"" + h.node + "\"], th[data-colnode=\"" + h.node + "\"]").removeClass(classColCollapsed + " " + classColShow).addClass(classColExpanded + " " + classColHide);
                replaceClass(h.th, classColHide, classColShow);
                return h.th.textContent = " " + arrowExpanded + " " + h.text;
            };
            var expandShowColSubtotal = function(h) {
                $(dataTable).find("tr td[data-colnode=\"" + h.node + "\"], th[data-colnode=\"" + h.node + "\"]").removeClass(classColCollapsed + " " + classColHide).addClass(classColExpanded + " " + classColShow);
                $(colHeaderTable).find("tr td[data-colnode=\"" + h.node + "\"], th[data-colnode=\"" + h.node + "\"]").removeClass(classColCollapsed + " " + classColHide).addClass(classColExpanded + " " + classColShow);
                h.th.colSpan++;
                return h.th.textContent = " " + arrowExpanded + " " + h.text;
            };
            var expandChildCol = function(ch, opts) {
                var chKey, k, len, ref, results;
                if (ch.children.length !== 0 && opts.hideOnExpand && ch.clickStatus === clickStatusExpanded) {
                    replaceClass(ch.th, classColHide, classColShow);
                } else {
                    showChildCol(ch);
                }
                if (ch.sTh && ch.clickStatus === clickStatusExpanded && opts.hideOnExpand) {
                    replaceClass(ch.sTh, classColShow, classColHide);
                }
                if (ch.clickStatus === clickStatusExpanded || ch.col >= opts.disableFrom) {
                    ref = ch.children;
                    results = [];
                    for (k = 0, len = ref.length; k < len; k++) {
                        chKey = ref[k];
                        results.push(expandChildCol(ch[chKey], opts));
                    }
                    return results;
                }
            };
            var expandCol = function(axisHeaders, h, opts) {
                var ch, chKey, colSpan, k, len, p, ref;
                if (h.clickStatus === clickStatusExpanded) {
                    adjustAxisHeader(axisHeaders, h.col, opts);
                    return;
                }
                colSpan = 0;
                ref = h.children;
                for (k = 0, len = ref.length; k < len; k++) {
                    chKey = ref[k];
                    ch = h[chKey];
                    expandChildCol(ch, opts);
                    colSpan += ch.th.colSpan;
                }
                h.th.colSpan = colSpan;
                if (h.col < opts.disableFrom) {
                    if (opts.hideOnExpand) {
                        expandHideColSubtotal(h);
                        --colSpan;
                    } else {
                        expandShowColSubtotal(h);
                    }
                }
                p = h.parent;
                while (p) {
                    p.th.colSpan += colSpan;
                    p = p.parent;
                }
                h.clickStatus = clickStatusExpanded;
                h.onClick = collapseCol;
                axisHeaders.ah[h.col].expandedCount++;
                return adjustAxisHeader(axisHeaders, h.col, opts);
            };
            var hideChildRow = function(ch, opts) {
                var cell, k, l, len, len1, ref, ref1, results;
                ref = ch.tr.querySelectorAll("th");
                for (k = 0, len = ref.length; k < len; k++) {
                    cell = ref[k];
                    replaceClass(cell, classRowShow, classRowHide);
                }
                ref = ch.dtr.querySelectorAll("td");
                for (k = 0, len = ref.length; k < len; k++) {
                    cell = ref[k];
                    replaceClass(cell, classRowShow, classRowHide);
                }
                if (ch.sTr) {
                    ref1 = ch.sTr.querySelectorAll("th");
                    results = [];
                    for (l = 0, len1 = ref1.length; l < len1; l++) {
                        cell = ref1[l];
                        results.push(replaceClass(cell, classRowShow, classRowHide));
                    }
                    ref1 = ch.dsTr.querySelectorAll("td");
                    results = [];
                    for (l = 0, len1 = ref1.length; l < len1; l++) {
                        cell = ref1[l];
                        results.push(replaceClass(cell, classRowShow, classRowHide));
                    }
                    return results;
                }
            };
            var collapseShowRowSubtotal = function(h, opts) {
                var cell, k, l, len, len1, ref, ref1, results;
                h.th.textContent = " " + arrowCollapsed + " " + h.text;
                ref = h.tr.querySelectorAll("th");
                for (k = 0, len = ref.length; k < len; k++) {
                    cell = ref[k];
                    removeClass(cell, classRowExpanded + " " + classRowHide);
                    addClass(cell, classRowCollapsed + " " + classRowShow);
                }
                ref = h.dtr.querySelectorAll("td");
                for (k = 0, len = ref.length; k < len; k++) {
                    cell = ref[k];
                    removeClass(cell, classRowExpanded + " " + classRowHide);
                    addClass(cell, classRowCollapsed + " " + classRowShow);
                }
                if (h.sTr) {
                    ref1 = h.sTr.querySelectorAll("th");
                    results = [];
                    for (l = 0, len1 = ref1.length; l < len1; l++) {
                        cell = ref1[l];
                        removeClass(cell, classRowExpanded + " " + classRowHide);
                        results.push(addClass(cell, classRowCollapsed + " " + classRowShow));
                    }
                    ref1 = h.dsTr.querySelectorAll("td");
                    results = [];
                    for (l = 0, len1 = ref1.length; l < len1; l++) {
                        cell = ref1[l];
                        removeClass(cell, classRowExpanded + " " + classRowHide);
                        results.push(addClass(cell, classRowCollapsed + " " + classRowShow));
                    }
                    return results;
                }
            };
            var collapseChildRow = function(ch, h, opts) {
                var chKey, k, len, ref;
                ref = ch.children;
                for (k = 0, len = ref.length; k < len; k++) {
                    chKey = ref[k];
                    collapseChildRow(ch[chKey], h, opts);
                }
                return hideChildRow(ch, opts);
            };
            var collapseRow = function(axisHeaders, h, opts) {
                var chKey, k, len, ref;
                ref = h.children;
                for (k = 0, len = ref.length; k < len; k++) {
                    chKey = ref[k];
                    collapseChildRow(h[chKey], h, opts);
                }
                collapseShowRowSubtotal(h, opts);
                h.clickStatus = clickStatusCollapsed;
                h.onClick = expandRow;
                axisHeaders.ah[h.col].expandedCount--;
                return adjustAxisHeader(axisHeaders, h.col, opts);
            };
            var showChildRow = function(ch, opts) {
                var cell, k, l, len, len1, ref, ref1, results;
                ref = ch.tr.querySelectorAll("th");
                for (k = 0, len = ref.length; k < len; k++) {
                    cell = ref[k];
                    replaceClass(cell, classRowHide, classRowShow);
                }
                ref = ch.dtr.querySelectorAll("td");
                for (k = 0, len = ref.length; k < len; k++) {
                    cell = ref[k];
                    replaceClass(cell, classRowHide, classRowShow);
                }
                if (ch.sTr) {
                    ref1 = ch.sTr.querySelectorAll("th");
                    results = [];
                    for (l = 0, len1 = ref1.length; l < len1; l++) {
                        cell = ref1[l];
                        results.push(replaceClass(cell, classRowHide, classRowShow));
                    }
                    ref1 = ch.dsTr.querySelectorAll("td");
                    results = [];
                    for (l = 0, len1 = ref1.length; l < len1; l++) {
                        cell = ref1[l];
                        results.push(replaceClass(cell, classRowHide, classRowShow));
                    }
                    return results;
                }
            };
            var expandShowRowSubtotal = function(h, opts) {
                var cell, k, l, len, len1, ref, ref1, results;
                h.th.textContent = " " + arrowExpanded + " " + h.text;
                ref = h.tr.querySelectorAll("th");
                for (k = 0, len = ref.length; k < len; k++) {
                    cell = ref[k];
                    removeClass(cell, classRowCollapsed + " " + classRowHide);
                    addClass(cell, classRowExpanded + " " + classRowShow);
                }
                ref = h.dtr.querySelectorAll("td");
                for (k = 0, len = ref.length; k < len; k++) {
                    cell = ref[k];
                    removeClass(cell, classRowCollapsed + " " + classRowHide);
                    addClass(cell, classRowExpanded + " " + classRowShow);
                }
                if (h.sTr) {
                    ref1 = h.sTr.querySelectorAll("th, td");
                    results = [];
                    for (l = 0, len1 = ref1.length; l < len1; l++) {
                        cell = ref1[l];
                        removeClass(cell, classRowCollapsed + " " + classRowHide);
                        results.push(addClass(cell, classRowExpanded + " " + classRowShow));
                    }
                    return results;
                }
            };
            var expandHideRowSubtotal = function(h, opts) {
                var cell, k, l, len, len1, ref, ref1, results;
                h.th.textContent = " " + arrowExpanded + " " + h.text;
                ref = h.tr.querySelectorAll("th, td");
                for (k = 0, len = ref.length; k < len; k++) {
                    cell = ref[k];
                    removeClass(cell, classRowCollapsed + " " + classRowShow);
                    addClass(cell, classRowExpanded + " " + classRowHide);
                }
                removeClass(h.th, classRowCollapsed + " " + classRowHide);
                addClass(cell, classRowExpanded + " " + classRowShow);
                if (h.sTr) {
                    ref1 = h.sTr.querySelectorAll("th, td");
                    results = [];
                    for (l = 0, len1 = ref1.length; l < len1; l++) {
                        cell = ref1[l];
                        removeClass(cell, classRowCollapsed + " " + classRowShow);
                        results.push(addClass(cell, classRowExpanded + " " + classRowHide));
                    }
                    return results;
                }
            };
            var expandChildRow = function(ch, opts) {
                var chKey, k, len, ref, results;
                if (ch.children.length !== 0 && opts.hideOnExpand && ch.clickStatus === clickStatusExpanded) {
                    replaceClass(ch.th, classRowHide, classRowShow);
                } else {
                    showChildRow(ch, opts);
                }
                if (ch.sTh && ch.clickStatus === clickStatusExpanded && opts.hideOnExpand) {
                    replaceClass(ch.sTh, classRowShow, classRowHide);
                }
                if (ch.clickStatus === clickStatusExpanded || ch.col >= opts.disableFrom) {
                    ref = ch.children;
                    results = [];
                    for (k = 0, len = ref.length; k < len; k++) {
                        chKey = ref[k];
                        results.push(expandChildRow(ch[chKey], opts));
                    }
                    return results;
                }
            };
            var expandRow = function(axisHeaders, h, opts) {
                var ch, chKey, k, len, ref;
                if (h.clickStatus === clickStatusExpanded) {
                    adjustAxisHeader(axisHeaders, h.col, opts);
                    return;
                }
                ref = h.children;
                for (k = 0, len = ref.length; k < len; k++) {
                    chKey = ref[k];
                    ch = h[chKey];
                    expandChildRow(ch, opts);
                }
                if (h.children.length !== 0) {
                    if (opts.hideOnExpand) {
                        expandHideRowSubtotal(h, opts);
                    } else {
                        expandShowRowSubtotal(h, opts);
                    }
                }
                h.clickStatus = clickStatusExpanded;
                h.onClick = collapseRow;
                axisHeaders.ah[h.col].expandedCount++;
                return adjustAxisHeader(axisHeaders, h.col, opts);
            };
            var collapseAxis = function(axisHeaders, col, attrs, opts) {
                var collapsible, h, i, k, ref, ref1, results;
                collapsible = Math.min(attrs.length - 2, opts.disableFrom - 1);
                if (col > collapsible) {
                    return;
                }
                results = [];
                for (i = k = ref = collapsible, ref1 = col; k >= ref1; i = k += -1) {
                    results.push((function() {
                        var l, len, ref2, results1;
                        ref2 = axisHeaders.ah[i].attrHeaders;
                        results1 = [];
                        for (l = 0, len = ref2.length; l < len; l++) {
                            h = ref2[l];
                            if (h.clickStatus === clickStatusExpanded && h.children.length !== 0) {
                                results1.push(axisHeaders.collapseAttrHeader(axisHeaders, h, opts));
                            }
                        }
                        return results1;
                    })());
                }
                return results;
            };
            var expandAxis = function(axisHeaders, col, attrs, opts) {
                var ah, h, i, k, ref, results;
                ah = axisHeaders.ah[col];
                results = [];
                for (i = k = 0, ref = col; 0 <= ref ? k <= ref : k >= ref; i = 0 <= ref ? ++k : --k) {
                    results.push((function() {
                        var l, len, ref1, results1;
                        ref1 = axisHeaders.ah[i].attrHeaders;
                        results1 = [];
                        for (l = 0, len = ref1.length; l < len; l++) {
                            h = ref1[l];
                            results1.push(axisHeaders.expandAttrHeader(axisHeaders, h, opts));
                        }
                        return results1;
                    })());
                }
                return results;
            };

            /** Adjusting sizes */
            var setFont = function($element, font, force, defaultFont) {
                if (defaultFont.fontStyle !== font.fontStyle) {
                    $element.css('fontStyle', font.fontStyle);
                }
                if (defaultFont.fontWeight !== font.fontWeight) {
                    $element.css('fontWeight', font.fontWeight);
                }
                if (defaultFont.fontFamily !== font.fontFamily) {
                    $element.css('fontFamily', font.fontFamily);
                }
                if (force || defaultFont.fontSize !== font.fontSize) {
                    $element.css('fontSize', font.fontSize);
                }
            };
            var applyFonts = function(fontOptions) {
                // Font to column header and axis will be same
                setFont($(axisTable).find('th'), fontOptions.colHeaderFont, false, defaults.fontOptions.colHeaderFont);
                setFont($(colHeaderTable).find('th'), fontOptions.colHeaderFont, false, defaults.fontOptions.colHeaderFont);

                // row header will have its own font
                setFont($(rowHeaderTable).find('th'), fontOptions.rowHeaderFont, false, defaults.fontOptions.rowHeaderFont);

                // data will have its own font
                setFont($(dataTable).find('td'), fontOptions.dataFont, false, defaults.fontOptions.dataFont);
            };
            var getSizeForN = function (n, unit) {
                return (n * unit) + (n - 1);
            };

            /** Adjusting sizes */
            var fitRows, fitCols, unitSize, axisSize, containerBounds;
            var setSizes = function(fontOptions) {
                if (sizesInitialized) return;
                sizesInitialized = true;

                containerBounds = {
                    height: $(result).height(),
                    width: $(result).width()
                };

                var dataUnits = getFontUnits(fontOptions.dataFont, defaults.fontOptions.dataFont);
                var rowUnits = getFontUnits(fontOptions.rowHeaderFont, defaults.fontOptions.rowHeaderFont);
                var columnUnits = getFontUnits(fontOptions.colHeaderFont, defaults.fontOptions.colHeaderFont);

                var units = {
                    height: Math.max(Math.max(rowUnits.height, dataUnits.height), columnUnits.height),
                    width: Math.max(Math.max(rowUnits.width, dataUnits.width), columnUnits.width)
                };
                unitSize = {
                    height: units.height + 10,
                    width: units.width + 10
                };
                var axisHeight = getSizeForN(colAttrs.length + 1, unitSize.height);
                var axisWidth = getSizeForN(rowAttrs.length + 1, unitSize.width);
                axisSize = {height: axisHeight, width: axisWidth};

                fitRows = Math.ceil((containerBounds.height - axisHeight) / unitSize.height);
                fitCols = Math.ceil((containerBounds.width - axisWidth) / unitSize.width);

                configSizes(fontOptions);
            };

            var configSizes = function(fontOptions) {
                var units = {
                    height: unitSize.height - 10,
                    width: unitSize.width - 10
                };
                setHeight($(result).find('.r1'), axisSize.height);
                setWidth($(result).find('.c1'), axisSize.width);

                setHeight($(result).find('th'), units.height);
                setHeight($(result).find('td'), units.height);
                setWidth($(result).find('th'), units.width);
                setWidth($(result).find('td'), units.width);

                applyFonts(fontOptions);
            };

            function setWidth($ele, width) {
                $ele.css('width', width);
                $ele.css('min-width', width);
                $ele.css('max-width', width);
            }

            function setHeight($ele, height) {
                $ele.css('height', height);
                $ele.css('min-height', height);
                $ele.css('max-height', height);
            }

            function getFontUnits(font, defaultFont) {
                var test = $(createElement('div', 'pivot_test'));
                test.css('position', 'absolute');
                test.css('visibility', 'hidden');
                test.css('height', 'auto');
                test.css('width', 'auto');
                test.css('white-space', 'nowrap');
                $(result).append(test);

                setFont(test, font, true, defaultFont);
                test.text("◢ Ravi Ostwal Jain");

                var height = Math.ceil(test.height());
                var width = Math.ceil(test.width());

                test.remove();

                return { height: height, width: width};
            }

            /** On demand rendering : Future v2
            var fitRows, fitCols, unitSize, axisSize, containerBounds, bufferSize = { c: rowCount, r: colCount}, onDemandRendering = false;
            var BoxRenderer = function(boxRow, boxCol, rStart, cStart, rEnd, cEnd) {
                this.boxRow = boxRow;
                this.boxCol = boxCol;
                this.rStar = rStart;
                this.cStart = cStart;
                this.rEnd = rEnd;
                this.cEnd = cEnd;

                var rowKeys, colKeys;

                this.render = function() {
                    rowKeys = pivotData.getRowKeys();
                    colKeys = pivotData.getColKeys();

                    var chKey, colAttrHeaders, colAxisHeaders, colKeyHeaders, k, l, len, len1, node, ref, ref1, rowAttrHeaders, rowAxisHeaders, rowKeyHeaders, tr;
                    rowAttrHeaders = [];
                    colAttrHeaders = [];
                    if (colAttrs.length !== 0 && colKeys.length !== 0) {
                        colKeyHeaders = processKeys(colKeys, "pvtColLabel");
                    }
                    if (rowAttrs.length !== 0 && rowKeys.length !== 0) {
                        rowKeyHeaders = processKeys(rowKeys, "pvtRowLabel");
                    }

                    if (colAttrs.length !== 0) {
                        colAxisHeaders = buildColAxisHeaders(rowAttrs, colAttrs, opts);
                        node = {
                            counter: 0
                        };
                        ref = colKeyHeaders.children;
                        for (k = 0, len = ref.length; k < len; k++) {
                            chKey = ref[k];
                            buildColHeader(colAxisHeaders, colAttrHeaders, colKeyHeaders[chKey], rowAttrs, colAttrs, node, opts);
                        }
                        buildRowTotalsHeader(colAxisHeaders.ah[0].ctr, rowAttrs, colAttrs);
                    }
                    if (rowAttrs.length !== 0) {
                        rowAxisHeaders = buildRowAxisHeaders(rowAttrs, colAttrs, opts);
                        if (colAttrs.length === 0) {
                            buildRowTotalsHeader(rowAxisHeaders.tr, rowAttrs, colAttrs);
                        }
                        node = {
                            counter: 0
                        };
                        ref1 = rowKeyHeaders.children;
                        for (l = 0, len1 = ref1.length; l < len1; l++) {
                            chKey = ref1[l];
                            buildRowHeader(rowAxisHeaders, rowAttrHeaders, rowKeyHeaders[chKey], rowAttrs, colAttrs, node, opts);
                        }
                    }
                    buildValues(colAttrHeaders, rowAttrHeaders, rowAttrs, colAttrs, opts);
                    tr = buildColTotalsHeader(rowAttrs, colAttrs);
                    rowHeaderTable.appendChild(tr);
                    if (colAttrs.length > 0) {
                        tr = createElement('tr');
                        buildColTotals(tr, colAttrHeaders, rowAttrs, colAttrs, opts);
                        dataTable.appendChild(tr);
                    }
                }
            };
            */

            /** Scrolling */
            var initScrolls = function() {
                var rowScroller, colScroller, coord = {x: 0, y: 0};

                var onDataScroll = function() {
                    var scroll = dataScroller.scroll();
                    if (coord.x === scroll.x.position && coord.y === scroll.y.position) return;

                    coord.x = scroll.x.position;
                    coord.y = scroll.y.position;
                    rowScroller.scroll({y : scroll.y.position});
                    colScroller.scroll({x : scroll.x.position});
                    onTableScroll({x : scroll.x, y: scroll.y});
                };

                var onRowScroll = function() {
                    var scroll = rowScroller.scroll();
                    if (coord.y === scroll.y.position) return;

                    coord.y = scroll.y.position;
                    dataScroller.scroll({y : scroll.y.position});
                    onTableScroll({y : scroll.y});
                };

                var onColScroll = function() {
                    var scroll = colScroller.scroll();
                    if (coord.x === scroll.x.position) return;

                    coord.x = scroll.x.position;
                    dataScroller.scroll({x : scroll.x.position});
                    onTableScroll({x : scroll.x});
                };

                var onContentSizeChanged = function() {
                    //setSizes(opts.fontOptions);
                };

                dataScroller = createScroller($(result).find('.c2.r2'),
                    {
                        x: 'scroll',
                        y: 'scroll'
                    },
                    {
                        onScroll: onDataScroll,
                        onContentSizeChanged: onContentSizeChanged
                    }, 'auto');

                rowScroller = createScroller($(result).find('.c1.r2'),
                    {
                        x: 'hidden',
                        y: 'scroll'
                    },
                    {
                        onScroll: onRowScroll
                    }, 'hidden');

                colScroller = createScroller($(result).find('.c2.r1'),
                    {
                        x: 'scroll',
                        y: 'hidden'
                    },
                    {
                        onScroll: onColScroll
                    }, 'hidden');
            };
            var createScroller = function($content, overflowBehavior, callbacks, visibility) {
                return OverlayScrollbars($content, {
                    className: opts.theme.indexOf('dark') > 0 ? 'os-theme-thin-light' : 'os-theme-thin-dark',
                    autoUpdate: true,
                    autoUpdateInterval: 500,
                    nativeScrollbarsOverlaid : {
                        showNativeScrollbars: false,
                        initialize : false
                    },
                    overflowBehavior: overflowBehavior,
                    scrollbars: {
                        visibility: visibility,
                        autoHide: 'leave',
                        autoHideDelay: 500,
                        dragScrolling: true,
                        clickScrolling: false,
                        touchSupport: true
                    },
                    callbacks: callbacks
                });
            };
            var onTableScroll = function(scroll) {
                // console.log(scroll.x, scroll.y);
            };

            /** First Render */
            var initTables = function() {
                var $outerContainer = $('\
                    <div style="width: 100%; height: 100%;">\
                        <div class="ultraPivotContainer" style="width: 100%; height: 100%; display: none; flex-direction: row;">\
                            <div class="c1" style="height: 100%; display: flex; flex-direction: column; overflow: hidden;">\
                                <div class="c1 r1" style="width: 100%;">\
                                    <table class="ultraPivot axisTable" style="width: 100%; height: 100%;"></table>\
                                </div>\
                                <div class="c1 r2" style="width: 100%; flex: 1; overflow: hidden;">\
                                    <table class="ultraPivot rowHeaderTable" style="width: 100%; height: fit-content;"></table>\
                                </div>\
                            </div>\
                            <div class="c2" style="width: fit-content; height: 100%; display: flex; flex-direction: column; overflow: hidden;">\
                                <div class="c2 r1" style="width: 100%; overflow: hidden;">\
                                    <table class="ultraPivot colHeaderTable" style="width: fit-content; height: 100%;"></table>\
                                </div>\
                                <div class="c2 r2" style="width: 100%; flex: 1; overflow: auto;">\
                                    <table class="ultraPivot dataTable" style="height: fit-content; width: fit-content;"></table>\
                                </div>\
                            </div>\
                            <div class="c3" style="flex: 1;"></div>\
                        </div>\
                    </div>\
                ');

                result = $outerContainer[0];
                $(result).addClass(opts.theme);
                axisTable = $outerContainer.find('.axisTable')[0];
                rowHeaderTable = $outerContainer.find('.rowHeaderTable')[0];
                colHeaderTable = $outerContainer.find('.colHeaderTable')[0];
                dataTable = $outerContainer.find('.dataTable')[0];

                /** On demand rendering : Future v2
                if ((rowCount * colCount) > opts.renderOnScroll.maxNoOfElements) {
                    var idealBufferSize = Math.round(Math.sqrt(opts.renderOnScroll.maxNoOfElements));
                    bufferSize.r = Math.min(rowCount, idealBufferSize);
                    if (bufferSize.r < idealBufferSize)
                        bufferSize.c = Math.round(opts.renderOnScroll.maxNoOfElements / bufferSize.r);
                    else
                        bufferSize.c = Math.min(colCount, idealBufferSize);

                    if (bufferSize.c < idealBufferSize)
                        bufferSize.r = Math.round(opts.renderOnScroll.maxNoOfElements / bufferSize.c);

                    onDemandRendering = bufferSize.r !== rowCount || bufferSize.c !== colCount;
                }
                */

            };
            var render = function(rowAttrs, rowKeys, colAttrs, colKeys) {
                var chKey, colAttrHeaders, colAxisHeaders, colKeyHeaders, k, l, len, len1, node, ref, ref1, rowAttrHeaders, rowAxisHeaders, rowKeyHeaders, tr;
                rowAttrHeaders = [];
                colAttrHeaders = [];
                if (colAttrs.length !== 0 && colKeys.length !== 0) {
                    colKeyHeaders = processKeys(colKeys, "pvtColLabel");
                }
                if (rowAttrs.length !== 0 && rowKeys.length !== 0) {
                    rowKeyHeaders = processKeys(rowKeys, "pvtRowLabel");
                }

                if (colAttrs.length !== 0) {
                    colAxisHeaders = buildColAxisHeaders(rowAttrs, colAttrs, opts);
                    node = {
                        counter: 0
                    };
                    ref = colKeyHeaders.children;
                    for (k = 0, len = ref.length; k < len; k++) {
                        chKey = ref[k];
                        buildColHeader(colAxisHeaders, colAttrHeaders, colKeyHeaders[chKey], rowAttrs, colAttrs, node, opts);
                    }
                    buildRowTotalsHeader(colAxisHeaders.ah[0].ctr, rowAttrs, colAttrs);
                }
                if (rowAttrs.length !== 0) {
                    rowAxisHeaders = buildRowAxisHeaders(rowAttrs, colAttrs, opts);
                    if (colAttrs.length === 0) {
                        buildRowTotalsHeader(rowAxisHeaders.tr, rowAttrs, colAttrs);
                    }
                    node = {
                        counter: 0
                    };
                    ref1 = rowKeyHeaders.children;
                    for (l = 0, len1 = ref1.length; l < len1; l++) {
                        chKey = ref1[l];
                        buildRowHeader(rowAxisHeaders, rowAttrHeaders, rowKeyHeaders[chKey], rowAttrs, colAttrs, node, opts);
                    }
                }
                buildValues(colAttrHeaders, rowAttrHeaders, rowAttrs, colAttrs, opts);
                tr = buildColTotalsHeader(rowAttrs, colAttrs);
                rowHeaderTable.appendChild(tr);
                if (colAttrs.length > 0) {
                    tr = createElement('tr');
                    buildColTotals(tr, colAttrHeaders, rowAttrs, colAttrs, opts);
                    dataTable.appendChild(tr);
                }
                buildGrandTotal(tr, rowAttrs, colAttrs, opts);

                collapseAxis(colAxisHeaders, opts.colSubtotalDisplay.collapseAt, colAttrs, opts.colSubtotalDisplay);
                collapseAxis(rowAxisHeaders, opts.rowSubtotalDisplay.collapseAt, rowAttrs, opts.rowSubtotalDisplay);
                result.setAttribute("data-numrows", rowKeys.length);
                result.setAttribute("data-numcols", colKeys.length);

                colHeadersTree = colAttrHeaders;
                rowHeadersTree = rowAttrHeaders;
                setTimeout(function () {
                    $(result).find('.ultraPivotContainer').css('display', 'flex');
                    initScrolls();
                    if (!sizesInitialized) {
                        setSizes(opts.fontOptions);
                    }
                }, 0);
                return result;
            };
            var main = function(rowAttrs, rowKeys, colAttrs, colKeys) {
                initTables();

                /** On demand rendering : Future v2
                var i, j, rows, cols, size = 50, rendererBoxes = [], maxRow, maxCol, startRow, endRow, startCol, endCol;
                rows = Math.ceil(rowCount / size);
                cols = Math.ceil(colCount / size);
                maxRow = rowCount -1;
                maxCol = colCount -1;
                for (i = 0; i < rows; i++) {
                    var boxRow = [];
                    for (j = 0; j < cols; j++) {
                        startRow = i * size; endRow = Math.min(maxRow, (((i + 1) * size) - 1));
                        startCol = j * size; endCol = Math.min(maxCol, (((j + 1) * size) - 1));
                        console.log(i, j, startRow + '-' + endRow, startCol + '-' + endCol);
                        var boxRenderer = new BoxRenderer(i, j, startRow, startCol, endRow, endCol);
                        boxRow.push(boxRenderer);
                    }
                    rendererBoxes.push(boxRow);
                } */

                var rs = render(rowAttrs, rowKeys, colAttrs, colKeys);
                for (var i in capabilities) {
                    if (capabilities.hasOwnProperty(i)) {
                        enableCapability(capabilities[i]);
                    }
                }
                return rs;
            };
        }

        $.ultraPivotUtils.subtotal_renderers = {
            "Table With Subtotal": function(pvtData, opts) {
                return new UltraPivotRenderer(pvtData, opts);
            },
            "Table With Subtotal Bar Chart": function(pvtData, opts) {
                var renderer = new UltraPivotRenderer(pvtData, opts);
                $(renderer.getTableElement()).barchart();
                return renderer;
            },
            "Table With Subtotal Heatmap": function(pvtData, opts) {
                var renderer = new UltraPivotRenderer(pvtData, opts);
                $(renderer.getTableElement()).heatmap("heatmap", opts);
                return renderer;
            },
            "Table With Subtotal Row Heatmap": function(pvtData, opts) {
                var renderer = new UltraPivotRenderer(pvtData, opts);
                $(renderer.getTableElement()).heatmap("rowheatmap", opts);
                return renderer;
            },
            "Table With Subtotal Col Heatmap": function(pvtData, opts) {
                var renderer = new UltraPivotRenderer(pvtData, opts);
                $(renderer.getTableElement()).heatmap("colheatmap", opts);
                return renderer;
            }
        };
    });
}).call(this);
