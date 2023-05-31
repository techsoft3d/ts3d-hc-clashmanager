function containsOnlyNumbersAndDot(str) {
    return /^[0-9.-]+$/.test(str);
  }


  function convertToMeters(str) {
    if (!str) return 0;
    
    let value = parseFloat(str);
    if (isNaN(value)) return 0;
    
    if (value > 100000 && str.endsWith("mm²")) {
      return (value / 1e+6).toFixed(2) + "m²";
    }
    else if (value > 100000 && str.endsWith("mm³")) {
        return (value / 1e+9).toFixed(2) + "m³";
    }
    return 0;
    
  }
class ScTree {

    static _index = 0;
    static _clippingBox = null;

    static setClippingBox(clippingBox) {
    
        ScTree._clippingBox = clippingBox;
    
    }

    constructor(viewer, useLayout, showRelationships, treediv, reldiv,propdiv) {

        this._viewer = viewer;

        ScTree.altPressed = false;        
        this._index = ScTree._index;

        ScTree._index++;
        this._menuCallback = null;
        this._selectionCallback = null;
        this._suppressSelection = false;
        this._selectRelatedSpaceElements = false;
        this._isolateRelatedSpaceElements = false;
        this._restrictToNodesList = null;
        this._disableSelection = false;
        this._suppressVisibilityToggle = false;
        
        this._breadcrums = [];
        if (useLayout)
        {        
            this._treediv = "scTreeModelTreeDiv";
            this._reldiv = "scTreeRelationshipDiv";
            this._propdiv = "scTreePropertyDiv";
        }
        else
        {
            this._treediv = treediv;
            this._reldiv =  reldiv;
            this._propdiv = propdiv;

        }


        $(document).on('keyup keydown', function (e) {
            ScTree.altPressed = e.altKey;
        });

        let _this = this;       
        this._showRelationships = showRelationships;


        this._viewer.setCallbacks({
            selectionArray: function (sel,state) { _this._handleSelection(sel,state); },
            visibilityChanged: function () {  setTimeout(function () { _this._updateBranchVisibility(); }, 50); }
        });

        if (useLayout) {
            this._generateLayout();
        }

        if (this._treediv)
            $("#" + this._treediv).append('<div id="' + this._treediv + 'Jstree" style="overflow: scroll; width:100%; height:100%; font-size:70%;overflow:auto"></div>');

        if (this._showRelationships && this._reldiv)
            $("#" + this._reldiv).append('<div id="' + this._reldiv + 'Jstree" style="overflow: scroll; width:100%; height:100%; font-size:70%;overflow:auto"></div>');

        if (this._propdiv)
            $("#" + this._propdiv).append('<div id="' + this._propdiv + 'Tabulator" style="overflow: hidden; zoom:0.7;width:99%; height:100%;"></div>');


        let style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = '.jstree-contextmenu { font-size: 11px; }';
        document.getElementsByTagName('head')[0].appendChild(style);        
    }

    setSuppressVisibilityToggle(suppressVisibilityToggle) {
        this._suppressVisibilityToggle = suppressVisibilityToggle;
    }

    getSuppressVisibilityToggle() {
        return this._suppressVisibilityToggle;
    }
    
    setSelectionCallback(callback) {
        this._selectionCallback = callback;
    }

    setDisableSelection(disableSelection) {
        this._disableSelection = disableSelection;
    }

    getDisableSelection() {
        return this._disableSelection;
    }

    setRestrictToNodes(nodelist) {
        if (!nodelist)
        {
            this._restrictToNodesList = null;
            return;
        }
        this._restrictToNodesList = nodelist;
        this._restrictToNodesHash = [];

        for (let i=0;i<this._restrictToNodesList.length;i++)
        {
            let currentNode = this._restrictToNodesList[i];
            while (true)
            {
                this._restrictToNodesHash[currentNode] = true;
                currentNode = this._viewer.model.getNodeParent(currentNode);
                if (this._restrictToNodesHash[currentNode] || currentNode == this._startnode)
                {
                    break;
                }
            }
        }         
    }

    getSelection() {
        let res = $("#" + this._treediv + "Jstree").jstree(true).get_selected();
        let nodeids = [];
        for (let i = 0; i < res.length; i++) {
            nodeids.push(parseInt(res[i].split("_")[0]));
        }
        return nodeids;
    }

    remove() {
        if (this._treediv) {
            if ($('#' + this._treediv + 'Jstree').jstree() != undefined)
                $('#' + this._treediv + 'Jstree').jstree().destroy();
        }

    }

    getStartNode()
    {
        return this._startnode;        
    }

    _findContextMenuItems(nodeid) {
        let res = this._viewer.selectionManager.getResults();
        let rr = [];
        for (let i = 0; i < res.length; i++) {
            rr.push(res[i].getNodeId());
        }

        if (rr.length == 0) {
            return [nodeid];
        }
        else {
            return rr;
        }
        

    }

    async _contextMenu(nodeid) {
        // The default set of all items
        let _this = this;
        let items = {
            isolateItem: { 
                label: "Isolate",
                action: function () {
                    _this._viewer.view.isolateNodes(_this._findContextMenuItems(nodeid), 500, true);
                }
            },
            zoomItem: { 
                label: "Zoom",
                separator_after: true,
                action: function () {
                    _this._viewer.view.fitNodes(_this._findContextMenuItems(nodeid), 500);
                }
            },
            showItem: { 
                label: "Show",
                action: function () {
                    _this._viewer.model.setNodesVisibility(_this._findContextMenuItems(nodeid), true);
                }
            },
            hideItem: {
                label: "Hide",
                separator_after: true,
                action: function () {
                    _this._viewer.model.setNodesVisibility(_this._findContextMenuItems(nodeid), false);
                }
            }

        };
        let properties = await this._viewer.model.getNodeProperties(nodeid);
        if (properties.TYPE != undefined && properties.TYPE == "IFCSPACE") {

            items["selectRelated"] = {
                label: "IFCSPACE: Select Related",
                action: function () {
                    _this.handleSpaces(nodeid, true, false, false);
                }
            };
            if (ScTree._clippingBox) {
                items["clipSpace"] = {
                    label: "IFCSPACE: Clip",
                    action: function () {
                        _this.handleSpaces(nodeid, false, false, true);
                    }
                };
            }
        }

        return items;
    }

    setMenuCallback(menucallback)
    {
        this._menuCallback = menucallback;
    }
    
    async refresh(startnode) {
        return new Promise((resolve, reject) => {
        let _this = this;
        if (startnode != undefined)
            this._startnode = startnode;
        else
            this._startnode = hwv.model.getRootNode();


        if (this._propdiv) {
            if (!this._propertyTable) {
                this._propertyTable = new Tabulator("#" + this._propdiv + "Tabulator", {
                    data: [],
                    dataTree: true,
                    dataTreeStartExpanded:true,
                    layout: "fitColumns",
                    columns: [                 //define the table columns             
                        {
                            title: "Name", field: "name", width: 190
                        },
                        {
                            title: "Value", field: "value"
                        }

                    ],
                   // initialSort:[{column:"name",dir:"asc"}]
                });
            }
            else
                this._propertyTable.clearData();
        }

        if (this._treediv) {
            if ($('#' + this._treediv + 'Jstree').jstree() != undefined)
                $('#' + this._treediv + 'Jstree').jstree().destroy();

            let pluginArray =  ["themes", "html_data", "contextmenu"];
            if (!this._suppressVisibilityToggle) {
                pluginArray.push("checkbox");
            }

            $('#' + this._treediv + 'Jstree').jstree({
                "core": {
                    "animation": 0,
                    "check_callback": true,
                    "themes": { "stripes": true },
                    'data': function (obj, cb) {
                        cb.call(this, _this._generateNodeChildren(obj.id));

                    }
                },
                "checkbox": {
                    "tie_selection": false,
                    "whole_node": false,
                    "three_state": true,

                },
                "contextmenu": {
                    "items": async function (node, buildcontextmenu) {
                            let nodeid = parseInt(node.id.split("_")[0]);
                            if (_this._menuCallback) {
                                let items = await _this._menuCallback(nodeid);
                                buildcontextmenu(items);
                            }
                            else {
                                let items = await _this._contextMenu(nodeid);
                                buildcontextmenu(items);
                            }
                    },
                    "select_node": false,
                },
                "plugins": pluginArray
            });



     //       $('#' + this._treediv + 'Jstree').jstree().defaults.contextmenu.select_node(true);

            $('#' + this._treediv + 'Jstree').on("changed.jstree", function (e, data) {
                if (data.node) {
                   
                    let nodeid = data.node.id.split("_")[0];

                    if (!_this._disableSelection) {
                            let selitems = [];
                            for (let i = 0; i < data.selected.length; i++) {
                                selitems.push(Communicator.Selection.SelectionItem.create(parseInt(data.selected[i].split("_")[0])));
                            }
                            if (!_this._suppressSelection) {
                                _this._viewer.selectionManager.set(selitems);
                            }
                        if (selitems.length == 1 && data.event)
                        {
                            _this._setSpaceVisibility(selitems[0].getNodeId());
                        }
                    }
                    else {
                        _this._generateSelectionBreadcrums();

                    }                                      
                    if (_this._showRelationships) {
                        _this._populateRelationships(parseInt(nodeid));
                    }

                    if (_this._selectionCallback) {
                        let nodeids = _this.getSelection();
                        _this._selectionCallback(nodeids);
                    }
                    
                }
               
                setTimeout(function () { _this._updateBranchVisibility(); }, 50);

            });

            $('#' + this._treediv + 'Jstree').on("check_node.jstree", function (e, data) {
                let nodeid = parseInt(data.node.id.split("_")[0]);
                _this._setVisibility(nodeid, true);
            });

            $('#' + this._treediv + 'Jstree').on("uncheck_node.jstree", function (e, data) {
                let nodeid = parseInt(data.node.id.split("_")[0]);
                _this._setVisibility(nodeid, false);

            });

            $('#' + this._treediv + 'Jstree').on("open_node.jstree", function (e, data) {
                _this._generateSelectionBreadcrums();
                setTimeout(function () { _this._updateBranchVisibility(); }, 50);

            });
        }

        $('#' + this._treediv + 'Jstree').on("loaded.jstree", async function (e, data) {
                let node = _this._startnode;
                while (1) {
                    let children = _this._viewer.model.getNodeChildren(node);
                    if (children.length > 1 || children.length == 0) {
                        if (children.length > 1) {
                            node = children[0];
                        }
                        break;
                    }
                    node = children[0];
                }
                await _this._openAndSelectTreeNode(node);

                resolve();
        });
    });
    }


    _generateLayout() {

        let html = "";
        html += '<div id="' + this._treediv + '" style="background-color:white;overflow: hidden; width:100%; height:100%"></div>';

        if (this._showRelationships)
            html += '<div id="' + this._reldiv + '" style="background-color:white;overflow: hidden; width:100%; height:100%"></div>';

        html += '<div id="' + this._propdiv + '" style="background-color:white;overflow: hidden; width:100%; height:100%"></div>';

        $(document.body).append(html);

        let _this = this;

        let config = {
            settings: {
                showPopoutIcon: false,
                showMaximiseIcon: true,
                showCloseIcon: true
            },
            content: [
                {
                    type: 'row',
                    content: [
                        {
                            type: 'column',
                            width: 50,
                            content: [
                                {
                                    type: 'stack',
                                    hasHeaders: false,
                                    content: [
                                        {
                                            type: 'component',
                                            componentName: 'Viewer',
                                            isClosable: false,
                                            height: 90,
                                            componentState: { label: 'A' }
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            type: 'column',
                            width: 25,
                            content: [
                                {
                                    type: 'component',
                                    componentName: 'Model Tree',
                                    isClosable: true,
                                    height: 40,
                                    componentState: { label: 'C' }
                                },
                                {
                                    type: 'component',
                                    height: 20,
                                    componentName: 'Relationships',
                                    isClosable: true,
                                    componentState: { label: 'C' }
                                },
                                {
                                    type: 'component',
                                    height: 20,
                                    componentName: 'Properties',
                                    isClosable: true,
                                    componentState: { label: 'C' }
                                },

                            ]
                        },
                    ],
                }]
        };

        if (!this._showRelationships) {
            config.content[0].content[1].content.splice(1, 1);
            config.content[0].content[1].content[0]["height"] = 60;
            config.content[0].content[1].content[1]["height"] = 40;
        }

        this._layout = new GoldenLayout(config);
        this._layout.registerComponent('Viewer', function (container, componentState) {
            $(container.getElement()).append($("#content"));
        });

        this._layout.registerComponent('Models', function (container, componentState) {
            $(container.getElement()).append($("#modelchoicepanel"));
        });


        this._layout.registerComponent('Model Tree', function (container, componentState) {
            $(container.getElement()).append($("#" + _this._treediv));
        });

        this._layout.registerComponent('Relationships', function (container, componentState) {
            $(container.getElement()).append($("#" + _this._reldiv));
        });

        this._layout.registerComponent('Properties', function (container, componentState) {
            $(container.getElement()).append($("#" + _this._propdiv));
        });

        this._layout.on('stateChanged', function () {
            if (_this._viewer != null) {
                _this._viewer.resizeCanvas();
                ui._toolbar.reposition();
            }
        });

        this._layout.init();


    }

    _updateBranchVisibilityRecursive(nodeid) {


        if (!this._suppressVisibilityToggle) {
            if ($("#" + this._treediv + "Jstree").jstree(true) == false)
                return;
            let node = $("#" + this._treediv + "Jstree").jstree(true).get_node(nodeid + "_" + this._index);

            let branchvisibility = hwv.model.getBranchVisibility(nodeid);
            let anchor = $("#" + nodeid + "_" + this._index + "_anchor");
            let li = anchor.find("i");
            if (branchvisibility == Communicator.BranchVisibility.Shown) {
                anchor.addClass("jstree-checked");
                $(li[0]).removeClass("jstree-undetermined");
                if (node) {
                    node.state.checked = true;
                    node.state.undetermined = undefined;
                }
            }
            else if (branchvisibility == Communicator.BranchVisibility.Hidden) {
                anchor.removeClass("jstree-checked");
                $(li[0]).removeClass("jstree-undetermined");
                if (node) {
                    node.state.checked = false;
                    node.state.undetermined = undefined;
                }
            }
            else {
                anchor.removeClass("jstree-checked");
                $(li[0]).addClass("jstree-undetermined");
                node.state.undetermined = true;
            }
            for (let i = 0; i < node.children.length; i++) {
                this._updateBranchVisibilityRecursive(parseInt(node.children[i]));
            }
        }
    }

    _updateBranchVisibility() {
        if (this._treediv) {
            this._updateBranchVisibilityRecursive(this._startnode);
        }

    }


    _restrictToNodes(children)
    {
        if (!this._restrictToNodesList)
            return children;

        let restricted = [];
        for (let i = 0; i < children.length; i++) {
            if (this._restrictToNodesHash[children[i]])
            {
                restricted.push(children[i]);
            }
        }
        return restricted;
    }

    _generateNodeChildren(nodeid, parent) {
        let children = [];
        if (nodeid == "#")
            children.push(this._startnode);
        else
        {
            nodeid = parseInt(nodeid);
            children = this._viewer.model.getNodeChildren(nodeid);
            children = this._restrictToNodes(children);
        }
        let carray = [];


        for (let i = 0; i < children.length; i++) {

            let hasChildren = false;
            let nodename = this._viewer.model.getNodeName(children[i]);
            let cchildren = this._viewer.model.getNodeChildren(children[i]);
            cchildren = this._restrictToNodes(cchildren);
            let visibility = this._viewer.model.getNodeVisibility(children[i]);
            let branchvisibility = hwv.model.getBranchVisibility(children[i]);
            if (cchildren.length > 0)
                hasChildren = true;

            if (branchvisibility == Communicator.BranchVisibility.Mixed) {
                carray.push({
                    "id": children[i].toString() + "_" + this._index,
                    "text": nodename,
                    "state": {
                        "undetermined": true,
                    },
                    "children": hasChildren
                });
            }
            else {
                carray.push({
                    "id": children[i].toString() + "_" + this._index,
                    "text": nodename,
                    "state": {
                        "checked": visibility,
                    },
                    "children": hasChildren
                });
            }
        }
        return carray;
    }

    async _setVisibility(nodeid, onoff) {


        let properties = await this._viewer.model.getNodeProperties(nodeid);

        if (properties.TYPE != undefined && properties.TYPE == "IFCSPACE") {
            let children = this._viewer.model.getNodeChildren(nodeid);
            this._viewer.model.setNodesVisibility(children, onoff);

        }
        else
            this._viewer.model.setNodesVisibility([nodeid], onoff);

    }

    _gatherNodesRelatedToSpace(nodeid) {
        let bimid = this._viewer.model.getBimIdFromNode(nodeid);

        this._currentRels = [];
        let reltypes = this._viewer.model.getRelationshipTypesFromBimId(nodeid, bimid);
        let data = null;
        for (let i = 0; i < reltypes.length; i++) {
            if (reltypes[i] == Communicator.RelationshipType.SpaceBoundary) {
                data = this._viewer.model.getBimIdConnectedElements(nodeid, bimid, reltypes[i]);
            }
        }
        let nodearray = [];
        let offset = this._viewer.model.getNodeIdOffset(nodeid);

        if (data) {
            for (let i = 0; i < data.relateds.length; i++) {
                nodearray.push(parseInt(data.relateds[i]) + offset);
            }
        }
        return nodearray;
    }

    async handleSpaces(nodeid, selectRelatedSpaceElements,isolateRelatedSpaceElements, clipSpace) {

      
        let children = this._viewer.model.getNodeChildren(nodeid);
        if (clipSpace) {
            for (let i=0;i<children.length;i++) {
                if (this._viewer.model.getNodeType(children[i]) == Communicator.NodeType.BodyInstance) {                
                    this._viewer.model.setNodesVisibility([children[i]],false);
                    break;
                }
            }
        }
        
        if (selectRelatedSpaceElements || isolateRelatedSpaceElements) {
            let relatedNodes = this._gatherNodesRelatedToSpace(nodeid);
            relatedNodes.push(nodeid);
            if (selectRelatedSpaceElements) {
                this._suppressSelection = true;
                let selitems = [];
                for (let i = 0; i < relatedNodes.length; i++) {
                    selitems.push(Communicator.Selection.SelectionItem.create(relatedNodes[i]));
                }

                this._viewer.selectionManager.add(selitems);
                this._suppressSelection = false;
            }
            if (isolateRelatedSpaceElements) {
                this._viewer.view.isolateNodes(relatedNodes, 500, true);
            }
        }
        if (clipSpace && ScTree._clippingBox) {
            ScTree._clippingBox.createFromNodes([nodeid]);
            if (!this._isolateRelatedSpaceElements) {
                this._viewer.view.fitNodes([nodeid], 0);
            }
        }       
    }


    async _setSpaceVisibility(nodeid) {

        let properties = await this._viewer.model.getNodeProperties(nodeid);

        if (properties.TYPE != undefined && properties.TYPE == "IFCSPACE") {
            let children = this._viewer.model.getNodeChildren(nodeid);
            this._viewer.model.setNodesVisibility(children, true);
        }
        else
        {
            if (ScTree._clippingBox && ScTree._clippingBox.getActive())
            {
                ScTree._clippingBox.deactivate();
            }
        }

    }

    async openTreeNode(selnode) {
        if (this._treediv) {
            let p = [];
            p.push(selnode);

            let nodeid = selnode;
            while (1) {
                let parent = this._viewer.model.getNodeParent(nodeid);
                p.push(parent);
                if (parent == this._viewer.model.getRootNode() || parent == this._startnode)
                    break;
                nodeid = parent;
            }

            for (let i = p.length - 1; i > 0; i--) {
                let node = $("#" + this._treediv + "Jstree").jstree(true).get_node(p[i].toString() + "_" + this._index);
                if (!node)
                    break;
                await this._openNode(node);
            }          
        }
    }


    async refreshTreeSelection() {
        let dstate  = this._disableSelection;
        this._disableSelection = false;
        await this.refresh(this._startnode);


        let res = this._viewer.selectionManager.getResults();
        let rr = [];
        for (let i = 0; i < res.length; i++) {
            await this.openTreeNode(res[i].getNodeId());   
            rr.push(res[i].getNodeId().toString() + "_" + this._index);                  
        }        
        let _this = this;
        setTimeout(function () { 
        $("#" + _this._treediv + "Jstree").jstree(true).select_node(rr);
        }, 50);
        this._disableSelection = dstate;
    }


    async _openAndSelectTreeNode(selnode) {        
        if (this._treediv) {
            if (this._viewer.model.getNodeParent(selnode) == null) {
                return;
            }
            let p = [];
            p.push(selnode);

            let nodeid = selnode;
            while (1) {
                let parent = this._viewer.model.getNodeParent(nodeid);
                p.push(parent);
                if (parent == this._viewer.model.getRootNode() || parent == this._startnode)
                    break;
                nodeid = parent;
            }

            for (let i = p.length - 1; i > 0; i--) {
                let node = $("#" + this._treediv + "Jstree").jstree(true).get_node(p[i].toString() + "_" + this._index);
                if (!node)
                    break;
                await this._openNode(node);
            }

            this._suppressSelection = true;
            $("#" + this._treediv + "Jstree").jstree(true).deselect_all();
            let node = $("#" + this._treediv + "Jstree").jstree(true).get_node(selnode.toString() + "_" + this._index);

            let res = this._viewer.selectionManager.getResults();
            let rr = [];
            if (!this._disableSelection) {
                for (let i = 0; i < res.length; i++) {
                    rr.push(res[i].getNodeId().toString() + "_" + this._index);               
                }
            }


            $("#" + this._treediv + "Jstree").jstree(true).select_node(rr);
            if ($("#" + this._treediv + "Jstree").jstree(true).get_node(selnode.toString() + "_" + this._index, true))
                $("#" + this._treediv + "Jstree").jstree(true).get_node(selnode.toString() + "_" + this._index, true).children('.jstree-anchor').focus();
            this._suppressSelection = false;
        }
    }

    async _openNode(node) {
        return new Promise((resolve, reject) => {
            $("#" + this._treediv + "Jstree").jstree(true).open_node(node, function () {
                resolve();
            });

        });
    }

    _handleSelection(sel, state) {
        if (!this._disableSelection) {
            if (sel.length == 0) {
                if (this._propdiv)
                    this._propertyTable.clearData();
                if (this._treediv)
                    $("#" + this._treediv + "Jstree").jstree().deselect_all(true);
                if (this._reldiv && this._suppressSelection == false) {
                    if ($("#" + this._reldiv + "Jstree").jstree() != undefined)
                        $("#" + this._reldiv + "Jstree").jstree().destroy();
                }
            }
            if (sel.length == 1) {
                if (this._propdiv) {
                    this._showProperties(sel[0].getSelection().getNodeId());
                }
                if (this._treediv) {
                    if (this._suppressSelection == false) {

                        this._openAndSelectTreeNode(sel[0].getSelection().getNodeId());
                    }
                }
            }

            if (this._treediv) {
                this._generateSelectionBreadcrums();
            }
        }

    }


    _generateSelectionBreadcrums() {
        if (!this._disableSelection) {
            let res = this._viewer.selectionManager.getResults();
            let rr = [];
            for (let nodeid in this._breadcrums) {
                $("#" + nodeid + "_" + this._index + "_anchor").css("background-color", "");

            }
            this._breadcrums = [];
            for (let i = 0; i < res.length; i++) {
                let nodeid = hwv.model.getNodeParent(res[i].getNodeId());
                while (1) {
                    if (!this._breadcrums[nodeid]) {
                        this._breadcrums[nodeid] = true;
                        $("#" + nodeid + "_" + this._index + "_anchor").css("background-color", "rgb(235,235,255)");
                    }
                    if (nodeid == null || nodeid == hwv.model.getRootNode() || nodeid == this._startnode)
                        break;
                    nodeid = hwv.model.getNodeParent(nodeid);


                }
            }
        }
        else {
            let res = $("#" + this._treediv + "Jstree").jstree(true).get_selected();
            let rr = [];
            for (let nodeid in this._breadcrums) {
                $("#" + nodeid + "_" + this._index + "_anchor").css("background-color", "");
            }
            this._breadcrums = [];
            for (let i = 0; i < res.length; i++) {
                let nodeid =  $("#" + this._treediv + "Jstree").jstree(true).get_parent(res[i]);
                nodeid = parseInt(nodeid.split("_")[0]);
                while (1) {
                    if (!this._breadcrums[nodeid]) {
                        this._breadcrums[nodeid] = true;
                        $("#" + nodeid + "_" + this._index + "_anchor").css("background-color", "rgb(235,235,255)");
                    }
                    if (nodeid == null || nodeid == hwv.model.getRootNode() || nodeid == this._startnode)
                        break;
                    nodeid = hwv.model.getNodeParent(nodeid);
                }
            }            
        }
    }


    _generatePropertiesRecursive(cur, pres) {

        if (typeof (pres) == "string")
            return;
        let carray = [];
        for (let p in pres) {
            let nx = { name: p };
            carray.push(nx);
            if (typeof (pres[p]) == "string") {
                if (nx.name.indexOf("Date") != -1 && !isNaN(parseInt(pres[p]))) {
                    let d = new Date(0);
                    d.setUTCSeconds(parseInt(pres[p]));
                    nx.value = d.toDateString();
                }
                else {                

                    if (containsOnlyNumbersAndDot(pres[p]) && !isNaN(parseFloat(pres[p]))) {
                        nx.value = parseFloat(pres[p]);
                    }
                    else {
                        if (convertToMeters(pres[p])) {
                            nx.value = convertToMeters(pres[p]);
                        }
                        else {
                            nx.value = pres[p];
                        }
                    }
                }
                continue;
            }
            this._generatePropertiesRecursive(nx, pres[p]);
        }
        cur._children = carray;

    }


    async _showProperties(nodeid) {


        let properties = await this._viewer.model.getNodeProperties(nodeid);
        this._propertyTable.clearData();
       
        let id = 0;
        let phash = [];
        for (let prop in properties) {
            let pel = prop.split("/");

            let phashcurrent = phash;

            for (let i = 0; i < pel.length; i++) {
                if (phashcurrent[pel[i]] == undefined)
                    phashcurrent[pel[i]] = [];
                if (i == pel.length - 1)
                    phashcurrent[pel[i]] = properties[prop];
                else
                    phashcurrent = phashcurrent[pel[i]];

            }
        }
      
        for (let px in phash) {
            let prop = { name: px };
            if (typeof (phash[px]) == "string") {
                if (convertToMeters(phash[px])) {
                    prop.value = convertToMeters(phash[px]);
                }
                else {
                    prop.value = phash[px];
                }
                     
            this._propertyTable.addData([prop], false);
            }
        }
     

        for (let px in phash) {
            let prop = { name: px };
            if (typeof (phash[px]) != "string") {
                this._generatePropertiesRecursive(prop, phash[px], undefined);
            
                this.generateOnePoperty(prop);
            }
        }

    }

    generateOnePoperty(prop) {
        let _this = this;
        setTimeout(function () {
            _this._propertyTable.addData([prop], false);
        }, 5);

    }



    _handleRelationshipVisibility(node, onoff) {
        if (node.id.indexOf("related") != -1 || node.id.indexOf("relating") != -1) {
            for (let i = 0; i < node.children.length; i++) {
                let nodeid = parseInt(node.children[i]);
                this._setVisibility(nodeid, onoff);
            }

        }
        else {
            let nodeid = parseInt(node.id);
            this._setVisibility(nodeid, onoff);
        }
    }

    _populateRelationships(nodeid) {


        if (this._reldiv) {
            let bimid = this._viewer.model.getBimIdFromNode(nodeid);

            this._currentRels = [];
            let reltypes = this._viewer.model.getRelationshipTypesFromBimId(nodeid, bimid);

            for (let i = 0; i < reltypes.length; i++) {
                this._currentRels.push({ type: reltypes[i], data: this._viewer.model.getBimIdConnectedElements(nodeid, bimid, reltypes[i]) });

            }
            if ($("#" + this._reldiv + "Jstree").jstree() != undefined)
                $("#" + this._reldiv + "Jstree").jstree().destroy();
            let _this = this;

            $("#" + this._reldiv + "Jstree").jstree({
                "core": {
                    "animation": 0,
                    "check_callback": true,
                    "themes": { "stripes": true },
                    'data': function (obj, cb) {
                        if (obj.id == "#") {
                            let ch = [];
                            for (let r = 0; r < _this._currentRels.length; r++) {

                                ch.push(
                                    {
                                        "id": _this._currentRels[r].type.toString(),
                                        "text": Communicator.RelationshipType[_this._currentRels[r].type],
                                        "children": true
                                    });
                            }

                            cb.call(this, ch);
                        }
                        else
                            cb.call(this, _this._generateRelationshipChildren(obj.original.id));

                    }
                },
                "plugins": ["themes", "html_data"]

            });

            $("#" + this._reldiv + "Jstree").on("select_node.jstree", function (e, data) {

                _this._handleRelationshipSelection(data.node.id, true);

            });


            $("#" + this._reldiv + "Jstree").on("check_node.jstree", function (e, data) {
                _this._handleRelationshipVisibility(data.node, true);

            });

            $("#" + this._reldiv + "Jstree").on("uncheck_node.jstree", function (e, data) {
                _this._handleRelationshipVisibility(data.node, false);
            });
        }
    }

    _handleRelationshipSelection(nodeid, onoff) {
        //        $('#scTreeModelTreeDivJstree').jstree().deselect_all(true);
        for (let r = 0; r < this._currentRels.length; r++) {
            let info = nodeid.split("@");
            if (info[0] == this._currentRels[r].type && info.length == 2) {
                let an;
                if (info[1] == "related")
                    an = this._currentRels[r].data.relateds;
                else
                    an = this._currentRels[r].data.relatings;
                
                this._suppressSelection = true;
                this._viewer.selectionManager.clear();
                let selitems = [];
                for (let i = 0; i < an.length; i++) {
                    selitems.push(Communicator.Selection.SelectionItem.create(parseInt(an[i])));
                }

                this._viewer.selectionManager.add(selitems);
                this._suppressSelection = false;

                return;
            }
        }
        nodeid = parseInt(nodeid);
        if (!ScTree.altPressed)
            this._suppressSelection = true;
        this._viewer.selectionManager.selectNode(parseInt(nodeid), Communicator.SelectionMode.Set);
        if (!ScTree.altPressed)
            this._suppressSelection = false;

    }



    _generateRelationshipChildren(nodeid) {

        let carray = [];
        for (let r = 0; r < this._currentRels.length; r++) {
            let info = nodeid.split("@");
            if (info[0] == this._currentRels[r].type) {
                if (info.length == 1) {
                    if (this._currentRels[r].data.relateds.length > 0) {
                        carray.push(
                            {
                                "id": nodeid + "@related",
                                "text": "related",                             
                                "children": true
                            });
                    }
                    if (this._currentRels[r].data.relatings.length > 0) {
                        carray.push(
                            {
                                "id": nodeid + "@relating",
                                "text": "relating",                              
                                "children": true
                            });
                    }

                }
                else {
                    let an;
                    if (info[1] == "related")
                        an = this._currentRels[r].data.relateds;
                    else
                        an = this._currentRels[r].data.relatings;

                    for (let i = 0; i < an.length; i++) {
                        let nodename = this._viewer.model.getNodeName(parseInt(an[i]));
                        carray.push(
                            {
                                "id": an[i],
                                "text": nodename,
                                "state": {
                                    "checked": true
                                },
                                "children": true
                            });
                    }
                }
                return carray;
            }
        }


        carray = [];
        nodeid = parseInt(nodeid);

        let children = this._viewer.model.getNodeChildren(nodeid);

        for (let i = 0; i < children.length; i++) {

            let hasChildren = false;
            let nodename = this._viewer.model.getNodeName(children[i]);
            let cchildren = this._viewer.model.getNodeChildren(children[i]);
            let visibility = this._viewer.model.getNodeVisibility(children[i]);
            if (cchildren.length > 0)
                hasChildren = true;

            carray.push({
                "id": children[i].toString(),
                "text": nodename,
                "state": {
                    "checked": visibility
                },
                "children": hasChildren
            });
        }

        return carray;
    }
}