//const serveraddress = "http://127.0.0.1:3000";
const serveraddress = null;



var myLayout;
var myClashManager;
var mySmartSearchManager;

var contextMenu;

var enableAutoZoom = true;
var enableAutoClip = false;
var enableAutoTransparent = true;
var enableAutoColor = true;
var enableClashTestWhenDragging = true;
var resultsTable = null;


var currentClashResults = null;
var groupTree1 = null;
var groupTree2 = null;

var activeClashType = 0;


function selectClashes(clashes) {
    let selections = [];
    let nodeids = [];
    for (let i = 0; i < clashes.length; i++) {
        nodeids.push(clashes[i].nodeid1);
        nodeids.push(clashes[i].nodeid2);
        selections.push(new Communicator.Selection.SelectionItem(clashes[i].nodeid1));
        selections.push(new Communicator.Selection.SelectionItem(clashes[i].nodeid2));
    }

    hwv.model.setNodesVisibility(nodeids, true);
    hwv.model.setNodesOpacity(nodeids, 1);

    hwv.selectionManager.set(selections);
}

function progressCallback(current, total) {
    const progressBar = document.getElementById('progressBar');

    if (current == 0) {
        const progressContainer = document.getElementById('progressContainer');
        progressBar.style.width = '0%';
        progressContainer.style.display = 'block';
    }
    else if (current == -1) {
        const progressContainer = document.getElementById('progressContainer');
        progressContainer.style.display = 'none';
    }
    else {
        let progress = Math.round(current / total * 100);
        progressBar.style.width = progress + '%';
    }
}

async function msready() {

    if (serveraddress) {
        $("#checkclashwhendragging").prop("checked", false);
        $("#checkclashwhendragging").prop("disabled", true);
        enableClashTestWhenDragging = false;
    }

    hwv.selectionManager.setHighlightFaceElementSelection(false)
    hwv.selectionManager.setNodeSelectionHighlightMode(Communicator.SelectionHighlightMode.OutlineOnly)
    hwv.selectionManager.setNodeSelectionOutlineColor(new Communicator.Color(255, 255, 0));
    hwv.selectionManager.setNodeSelectionColor(new Communicator.Color(255, 255, 0));
    hwv.setCallbacks({
        handleEvent: async function (type, nodeids, mat1, mat2) {
            if (nodeids[0] > 0) {
                await myClashManager.invalidateNodes([nodeids[0]]);
                if (enableClashTestWhenDragging) {
                    let clashResults = await myClashManager.calculateClashesForSingleNode(nodeids[0]);
                    selectClashes(clashResults);
                }
            }
        },
    });

  
    myClippingBox = new ClippingBox(hwv);
    myClippingBox.setExtraScale(1.3);
    myClippingBox.setOpacity(0.0);

    var op = hwv.operatorManager.getOperator(Communicator.OperatorId.Orbit);
    op.setOrbitFallbackMode(Communicator.OrbitFallbackMode.CameraTarget);

    mySmartSearchManager = new hcSmartSearch.SmartSearchManager(hwv);
    mySmartSearchManager.setKeepSearchingChildren(false);
    hcSmartSearch.SmartSearchEditorUI.initialize("searchtools", mySmartSearchManager);

    myClashManager = new hcClashManager.ClashManager(hwv);
    if (serveraddress) {
        await myClashManager.initializeServer(serveraddress,window.location.href.split("/").pop());
    }
    myClashManager.setFull();
    myClashManager.setProgressCallback(progressCallback);

    hwv.selectionManager.setSelectionFilter(function (nodeid) {
        return nodeid;
    }
    );

    $("#tolerance").val(myClashManager.getTolerance());
    $("#clearance").val(myClashManager.getClearance());


    $("#tolerance").change(function () {
        myClashManager.setTolerance(parseFloat($("#tolerance").val()));
    });

    $("#clearance").change(function () {
        myClashManager.setClearance(parseFloat($("#clearance").val()));
    });

    let rowMenu = [
        {
            label: "<i class='fas fa-user'></i> Select First",
            action: async function (e, row) {
                hwv.selectionManager.clear();
                hwv.selectionManager.selectNode(parseInt(row.getData().id));
            }
        },
        {
            label: "<i class='fas fa-user'></i> Select Second",
            action: async function (e, row) {
                hwv.selectionManager.clear();
                hwv.selectionManager.selectNode(parseInt(row.getData().targetID));
            }
        },
        {
            label: "<i class='fas fa-user'></i> Isolate",
            action: async function (e, row) {
                hwv.view.isolateNodes([parseInt(row.getData().id), parseInt(row.getData().targetID)]);
            }
        }
    ];



    resultsTable = new Tabulator("#clashlist", {
        data: [],
        dataTree: true,
        dataTreeStartExpanded: true,
        selectable: true,
        selectableRangeMode: "click",
        layout: "fitColumns",
        rowContextMenu: rowMenu,
        columns: [
            {
                title: "Item 1", field: "name", minWidth: 80
            },
            {
                title: "ID", field: "id", width: 48
            },
            {
                title: "Item 2", minWidth: 80, field: "targetName"
            },
            {
                title: "ID", width: 48, field: "targetID"
            },
            {
                title: "C", width: 20, field: "clash", sorter: "string"
            },
            {
                title: "T", width: 20, field: "touching", sorter: "string"
            },          
            {
                title: "Dist", width: 60, field: "distance", sorter: "number"
            },

        ],
    });

    resultsTable.on("rowSelectionChanged", async function (e, row) {
        let rows = resultsTable.getSelectedData();
        await myClippingBox.deactivate();
        await hwv.selectionManager.clear();
        let selections = [];
        let nodes = [];
        let nodes1 = [];
        let nodes2 = [];
        for (let i = 0; i < rows.length; i++) {
            let id1 = parseInt(rows[i].id);
            let id2 = parseInt(rows[i].targetID);
            nodes.push(id1, id2);
            nodes1.push(id1);
            nodes2.push(id2);
            selections.push(new Communicator.Selection.SelectionItem(id1));
            selections.push(new Communicator.Selection.SelectionItem(id2));
        }

        await hwv.selectionManager.add(selections);
        if (enableAutoClip) {
            await setClipBox();
        }

        for (let i = 0; i < nodes.length; i++) {
            if (hwv.model.getBranchVisibility(nodes[i]) != Communicator.BranchVisibility.Shown) {
                await hwv.model.setNodesVisibility([nodes[i]], true);
            }
        }

        if (enableAutoTransparent) {
            hwv.model.setNodesOpacity([0], 0.2);
            hwv.model.setInstanceModifier(Communicator.InstanceModifier.DoNotSelect, [hwv.model.getRootNode()], true);
            await hwv.model.setNodesOpacity(nodes, 1.0);
            hwv.model.setInstanceModifier(Communicator.InstanceModifier.DoNotSelect, nodes, false);

        }
        if (enableAutoColor) {
            await hwv.model.setNodesFaceColor(nodes1,new Communicator.Color(255,0,0));
            await hwv.model.setNodesFaceColor(nodes2,new Communicator.Color(0,255,0));
        }
        if (enableAutoZoom) {
            if (enableAutoClip) {
                hwv.view.fitNodes(nodes, 0);
            }
            else {
                hwv.view.fitNodes(nodes, 500);
            }
        }
        

    });

    groupTree1 = new ScTree(hwv, false, false, "grouptree1", null, null);
    groupTree1.setSuppressVisibilityToggle(true);
    groupTree1.setDisableSelection(true);
    groupTree1.refresh(0);

    groupTree2 = new ScTree(hwv, false, false, "grouptree2", null, null);
    groupTree2.setSuppressVisibilityToggle(true);
    groupTree2.setDisableSelection(true);
    groupTree2.refresh(0);

}


function startup() {
    createUILayout();
}

function createUILayout() {

    var config = {
        settings: {
            showPopoutIcon: false,
            showMaximiseIcon: true,
            showCloseIcon: false
        },
        content: [
            {
                type: 'row',
                content: [
                    {
                        type: 'column',
                        content: [{
                            type: 'component',
                            componentName: 'Viewer',
                            isClosable: false,
                            width: 55,
                            componentState: { label: 'A' }
                        },
                        {
                            type: 'row',
                            width: 20,
                            height: 30,
                            content: [
                                {
                                    type: 'component',
                                    componentName: 'Search',
                                    isClosable: true,
                                    width: 30,
                                    height: 50,
                                    componentState: { label: 'C' }
                                },
                                {
                                    type: 'component',
                                    componentName: 'Clash Groups',
                                    isClosable: true,
                                    width: 50,
                                    height: 50,
                                    componentState: { label: 'C' }
                                },
                            ]
                        }
                        ],
                    },
                    {
                        type: 'column',
                        width: 30,
                        content: [
                            {
                                type: 'component',
                                componentName: 'Clash',
                                isClosable: true,
                                height: 15,
                                componentState: { label: 'C' }
                            }
                        ]
                    },
                ],
            }]
    };



    myLayout = new GoldenLayout(config);
    myLayout.registerComponent('Viewer', function (container, componentState) {
        $(container.getElement()).append($("#content"));
    });

    myLayout.registerComponent('Clash', function (container, componentState) {
        $(container.getElement()).append($("#settingsdiv"));
    });

    myLayout.registerComponent('Search', function (container, componentState) {
        $(container.getElement()).append($("#searchtools"));
    });

    myLayout.registerComponent('Clash Groups', function (container, componentState) {
        $(container.getElement()).append($("#grouptree"));
    });


    myLayout.on('stateChanged', function () {
        if (hwv != null) {
            hwv.resizeCanvas();

        }
    });
    myLayout.init();

}

async function calculateClashResults(type) {

    if (type == 0) {
        if (activeClashType != 0) {
            await myClashManager.setFull();
        }
        activeClashType = 0;
    }
    else if (type == 1) {
        let nodes1 = groupTree1.getSelection();
        let nodes2 = groupTree2.getSelection();

        await myClashManager.setSourceNodes(nodes1);
        await myClashManager.setTargetNodes(nodes2);
        activeClashType = 1;

    }
    resultsTable.clearData();
    if (type == 2) {
        currentClashResults = await myClashManager.calculateClashesForSingleNode(hwv.selectionManager.getLast().getNodeId());
    }
    else {
        currentClashResults = await myClashManager.calculateClashes();
    }
    
    selectClashes(currentClashResults);

    let tableData = [];
    for (let i = 0; i < currentClashResults.length; i++) {
        let ores = currentClashResults[i];
        let firstparent = ores.nodeid1;
        let secondparent = ores.nodeid2;
        let isClash = " "
        let isClearance = "  ";
        let isTouching = " ";
        if (ores.isClash != undefined) {
            if (ores.isClash) {
                isClash = "T";
            } else {
                isClash = "F";
            }
        }

        if (ores.isWithinClearance != undefined) {
            if (ores.isWithinClearance) {
                isClearance = "T";
            } else {
                isClearance = "F";
            }
        }

        if (ores.isTouching != undefined) {
            if (ores.isTouching) {
                isTouching = "T";
            } else {
                isTouching = "F";
            }
        }
        tableData.push({ clash: isClash, touching: isTouching, name:  hwv.model.getNodeName(hwv.model.getNodeParent(firstparent)) + "/" + hwv.model.getNodeName(firstparent), 
            id: firstparent, targetName:  hwv.model.getNodeName(hwv.model.getNodeParent(secondparent)) + "/" + hwv.model.getNodeName(secondparent), targetID: secondparent, distance: ores.distance });
    }
    resultsTable.setData(tableData);
}

function setExcludeNodes() {

    if (myClashManager.getExcludeNodesSet()) {
        $("#setexcludebutton").removeClass("button-4selected");
        myClashManager.clearExcludeNodes();
    }
    else {
        let selections = hwv.selectionManager.getResults();
        let sourceNodes = [];
        for (let i = 0; i < selections.length; i++) {
            sourceNodes.push(selections[i].getNodeId());
        }
        myClashManager.setExcludeNodes(sourceNodes);
        $("#setexcludebutton").addClass("button-4selected");
    }
}

async function setClipBox() {
    let rows = hwv.selectionManager.getResults();
    let nodes = [];
    for (let i = 0; i < rows.length; i++) {
        nodes.push(rows[i].getNodeId());
    }
    await myClippingBox.createFromNodes(nodes);
}

async function fullReset() {
    await myClippingBox.deactivate();
    hwv.model.reset();
    hwv.model.setInstanceModifier(Communicator.InstanceModifier.DoNotSelect, [hwv.model.getRootNode()], false);
    hwv.model.resetNodesColor([0]);
}

function colorizeResults() {
    myClashManager.colorizeResults(currentClashResults);
}

function setFromSelection(which) {
    if (which == 0) {
        groupTree1.refreshTreeSelection();
    }
    else {
        groupTree2.refreshTreeSelection();
    }
}



function showSelectionFromTree(which) {
    let nodeids;
    if (which == 0) {
        nodeids = groupTree1.getSelection();
    }
    else {
        nodeids = groupTree2.getSelection();
    }

    let selections = [];

    for (let i=0;i<nodeids.length;i++) {
      selections.push(new Communicator.Selection.SelectionItem(parseInt(nodeids[i])));
    }
    hwv.selectionManager.set(selections);


}