class ClippingBox {

    constructor(viewer) {
        this._viewer = viewer;
        this._createCubeMeshes();
        this._standinMeshInstanceNode = null;
        this._tolerance = 0;
        this._doCut = true;
        this._opacity = 0.1;
        this._onTop = true;
        this._extraScale = 1.0;

        let _this = this;
        this._viewer.setCallbacks({
            handleEvent: function (type, nodeids, mat1, mat2) {
                _this._handleEvent(type, nodeids, mat1, mat2);
            },
        });
    }

    setExtraScale(scale) {
        this._extraScale = scale;        
    }

    getExtraScale() {
        return this._extraScale;
    }

    getActive()
    {
        return this._standinMeshInstanceNode != null;
    }

    setOpacity(opacity)
    {
        this._opacity = opacity;
        if (this._standinMeshInstanceNode != null) {
            this._viewer.model.setNodesOpacity([this._faceMeshNode], this._opacity);
        }
    }


    setEnableOnTop(onoff)
    {
        this._onTop = onoff;
        if (this._standinMeshInstanceNode != null) {
            if (this._onTop) {
                this._viewer.model.setDepthRange([this._faceMeshNode], 0, 0.1);
            }
            else {
                this._viewer.model.unsetDepthRange([this._faceMeshNode]);
            }
        }
    }


    async setEnableCutting(doCut) {
        this._doCut = doCut;

        if (!doCut) {
            for (let i=0;i<6;i++)
            {
                await this._viewer.cuttingManager.getCuttingSection(i).deactivate();    
            }
        }
        else {
            this.refresh();
        }
    }

    getEnableCutting() {
        return this._doCut;
    }

    async createFromNodes(nodeids) {

        this._viewer.cuttingManager.setCappingGeometryVisibility(false);
        let bounds = await this._viewer.model.getNodesBounding(nodeids, true, false, true);
        this._tolerance = Communicator.Point3.subtract(bounds.max, bounds.min).length()/500;
        await this._showStandinMesh(bounds);
        this.refresh();
   }

    async deactivate() {

        if (this._standinMeshInstanceNode != null)
        {
            await this._viewer.model.deleteNode(this._standinMeshInstanceNode);
            this._standinMeshInstanceNode = null;
        }
        for (let i=0;i<6;i++)
        {
            await this._viewer.cuttingManager.getCuttingSection(i).deactivate();

        }
    }

    getNode() {
        return this._standinMeshInstanceNode;
    }

    showMovementHandles() {
        let op = this._viewer.operatorManager.getOperator(Communicator.OperatorId.Handle);
        op.addHandles([this._standinMeshInstanceNode], null);
    }

    
    scaleEvent(nodeid) {
        if (this._standinMeshInstanceNode == nodeid )
            this.refresh();

    }

    _handleEvent(type, nodeids, mat1, mat2) {
        if (this._standinMeshInstanceNode != null)
        {
            for (let i=0;i<nodeids.length;i++)
            {
                if (nodeids[i] == this._standinMeshInstanceNode)
                {
                    this.refresh();
                    break;
                }
            }
        }

    }

    async _showStandinMesh(bounds) {
        if (this._standinMeshInstanceNode != null)
            await this._viewer.model.deleteNode(this._standinMeshInstanceNode);


        this._standinMeshInstanceNode = this._viewer.model.createNode(this._viewer.model.getRootNode(), "clipbox");

        let myMeshInstanceData1 = new Communicator.MeshInstanceData(this._standinMesh1);
        this._faceMeshNode = await this._viewer.model.createMeshInstance(myMeshInstanceData1, this._standinMeshInstanceNode);

        let myMeshInstanceData2 = new Communicator.MeshInstanceData(this._standinMesh2);
        let nodeid2 = await this._viewer.model.createMeshInstance(myMeshInstanceData2, this._standinMeshInstanceNode);

        if (this._onTop) {
            this._viewer.model.setDepthRange([this._faceMeshNode], 0, 0.1);
        }
        else {
            this._viewer.model.unsetDepthRange([this._faceMeshNode]);
        }

        let matrix = new Communicator.Matrix();
        let extents = bounds.extents();
        extents.scale(this._extraScale);
        let center = bounds.center();
        matrix.setScaleComponent(extents.x + this._tolerance, extents.y + this._tolerance, extents.z + this._tolerance);
        matrix.setTranslationComponent(center.x, center.y, center.z);
        await this._viewer.model.setNodeMatrix(this._standinMeshInstanceNode, matrix);
        this._viewer.model.setInstanceModifier(Communicator.InstanceModifier.DoNotCut, [this._standinMeshInstanceNode], true);
        this._viewer.model.setInstanceModifier(Communicator.InstanceModifier.DoNotSelect, [this._standinMeshInstanceNode], true);
        this._viewer.model.setNodesFaceColor([this._standinMeshInstanceNode], new Communicator.Color(0, 0, 255));
        this._viewer.model.setNodesLineColor([this._standinMeshInstanceNode], new Communicator.Color(0, 0, 255));
        this._viewer.model.setNodesOpacity([this._faceMeshNode], this._opacity);

    }

    async refresh() {
        if (!this._standinMeshInstanceNode)
        {
            return;
        }
        let mat = await this._viewer.model.getNodeMatrix(this._standinMeshInstanceNode);
        await this._createTransformedPlane(new Communicator.Point3(-0.5, -0.5, -0.5), new Communicator.Point3(-1, 0, 0), 0);
        await this._createTransformedPlane(new Communicator.Point3(0.5, -0.5, -0.5), new Communicator.Point3(1, 0, 0), 1);

        await this._createTransformedPlane(new Communicator.Point3(-0.5, -0.5, -0.5), new Communicator.Point3(0, -1, 0), 2);
        await this._createTransformedPlane(new Communicator.Point3(-0.5, 0.5, -0.5), new Communicator.Point3(0, 1, 0), 3);

        await this._createTransformedPlane(new Communicator.Point3(-0.5, -0.5, -0.5), new Communicator.Point3(0, 0, -1), 4);
        await this._createTransformedPlane(new Communicator.Point3(-0.5, -0.5, 0.5), new Communicator.Point3(0, 0, 1), 5);

    }

    async _createTransformedPlane(p, n, index) {
        let mat = await this._viewer.model.getNodeMatrix(this._standinMeshInstanceNode);
        let normalmat = mat.normalMatrix();

        let pnew = mat.transform(p);
        let nnew = normalmat.transform(n);
        if (this._doCut) {
            await this._createCuttingPlane(pnew, nnew, index);
        }
        else {

        }
    }

    async _createCuttingPlane(inpos, normal, num) {
        let pos = new Communicator.Point3(inpos.x + normal.x * this._tolerance, inpos.y + normal.y * this._tolerance, inpos.z + normal.z * this._tolerance);
        const plane = Communicator.Plane.createFromPointAndNormal(pos, normal);
        const cuttingSection = this._viewer.cuttingManager.getCuttingSection(num);
        await cuttingSection.clear();
        await cuttingSection.addPlane(plane);
        await cuttingSection.activate();
    }

    async _createCubeMeshes() {
        this._standinMesh1 = await this._createCubeMesh(this._viewer, true);
        this._standinMesh2 = await this._createCubeMesh(this._viewer, false);
    }    

    async calculateEntitiesInVolume(select = true, configIn = null) {
        if (!this._standinMeshInstanceNode)
        {
            return;
        }
        let planes = [];
        planes.push(await this._calculateTransformedPlane(new Communicator.Point3(-0.5, -0.5, -0.5), new Communicator.Point3(-1, 0, 0), 0));
        planes.push(await this._calculateTransformedPlane(new Communicator.Point3(0.5, -0.5, -0.5), new Communicator.Point3(1, 0, 0), 1));

        planes.push(await this._calculateTransformedPlane(new Communicator.Point3(-0.5, -0.5, -0.5), new Communicator.Point3(0, -1, 0), 2));
        planes.push(await this._calculateTransformedPlane(new Communicator.Point3(-0.5, 0.5, -0.5), new Communicator.Point3(0, 1, 0), 3));

        planes.push(await this._calculateTransformedPlane(new Communicator.Point3(-0.5, -0.5, -0.5), new Communicator.Point3(0, 0, -1), 4));
        planes.push(await this._calculateTransformedPlane(new Communicator.Point3(-0.5, -0.5, 0.5), new Communicator.Point3(0, 0, 1), 5));

        let config;
        if (!configIn) {
            config = new Communicator.IncrementalPickConfig();
            config.ignoreCuttingSections = true;
            config.allowFaces = true;
            config.allowPoints = true;
            config.allowLines = true;
            config.mustBeFullyContained = false;
        }
        else {
            config = configIn;
        }

        let mat = await this._viewer.model.getNodeMatrix(this._standinMeshInstanceNode);
        let center = mat.transform(new Communicator.Point3(0, 0, 0));
        let handle = await this._viewer.view.beginConvexPolyhedronSelection(planes, center, config);

        if (!select) {
            this._viewer.pauseRendering();
        }

        while (1) {
            let loop = await this._viewer.selectionManager.advanceIncrementalSelection(handle);
            if (!loop) {
                break;
            }
        }
        let sres = this._viewer.selectionManager.getResults();
        if (!select) {
            await this._viewer.selectionManager.clear();
            this._viewer.resumeRendering();
        }
        return sres;
    }

    async _calculateTransformedPlane(p, n, index) {
        let mat = await this._viewer.model.getNodeMatrix(this._standinMeshInstanceNode);
        let normalmat = mat.normalMatrix();

        let inpos = mat.transform(p);
        let normal = normalmat.transform(n);

        let pos = new Communicator.Point3(inpos.x + normal.x * this._tolerance, inpos.y + normal.y * this._tolerance, inpos.z + normal.z * this._tolerance);
        return Communicator.Plane.createFromPointAndNormal(pos, new Communicator.Point3(-normal.x, -normal.y, -normal.z));
    }

    async _createCubeMesh(viewer, showFaces, offset, scale) {
        let length;
        if (scale != undefined)
            length = 0.5 * scale;
        else
            length = 0.5;


        let meshData = new Communicator.MeshData();
        meshData.setFaceWinding(Communicator.FaceWinding.Clockwise);
       
        let vertices = [
            //front
            -length, length, length, length, length, length, -length, -length, length,
            length, length, length, length, -length, length, -length, -length, length,
            //back
            length, length, -length, -length, length, -length, -length, -length, -length,
            length, length, -length, -length, -length, -length, length, -length, -length,
            //top
            -length, length, -length, length, length, -length, length, length, length,
            -length, length, -length, length, length, length, -length, length, length,
            //bottom
            -length, -length, -length, length, -length, length, length, -length, -length,
            -length, -length, -length, -length, -length, length, length, -length, length,
            //left
            -length, length, -length, -length, length, length, -length, -length, -length,
            -length, length, length, -length, -length, length, -length, -length, -length,
            //right
            length, length, length, length, length, -length, length, -length, -length,
            length, length, length, length, -length, -length, length, -length, length
        ];
        if (offset != undefined) {

            for (let i = 0; i < vertices.length; i += 3) {
                vertices[i] += offset.x;
                vertices[i + 1] += offset.y;
                vertices[i + 2] += offset.z;
            }
        }
        let normals = [
            //front
            0, 0, 1, 0, 0, 1, 0, 0, 1,
            0, 0, 1, 0, 0, 1, 0, 0, 1,
            //back
            0, 0, -1, 0, 0, -1, 0, 0, -1,
            0, 0, -1, 0, 0, -1, 0, 0, -1,
            //top
            0, 1, 0, 0, 1, 0, 0, 1, 0,
            0, 1, 0, 0, 1, 0, 0, 1, 0,
            //bottom
            0, -1, 0, 0, -1, 0, 0, -1, 0,
            0, -1, 0, 0, -1, 0, 0, -1, 0,
            //left
            -1, 0, 0, -1, 0, 0, -1, 0, 0,
            -1, 0, 0, -1, 0, 0, -1, 0, 0,
            //right
            1, 0, 0, 1, 0, 0, 1, 0, 0,
            1, 0, 0, 1, 0, 0, 1, 0, 0
        ];

       
        let polylines = [
            [
                -length, length, length,
                length, length, length,
                length, -length, length,
                -length, -length, length,
                -length, length, length
            ],
            [
                length, length, length,
                length, length, -length,
                length, -length, -length,
                length, -length, length,
                length, length, length
            ],
            [
                -length, length, -length,
                length, length, -length,
                length, -length, -length,
                -length, -length, -length,
                -length, length, -length
            ],
            [
                -length, length, length,
                -length, length, -length,
                -length, -length, -length,
                -length, -length, length,
                -length, length, length
            ]
        ];
        if (showFaces)
            meshData.addFaces(vertices, normals);
        else {
            for (let i = 0; i < polylines.length; i++)
                meshData.addPolyline(polylines[i]);
        }
        return await viewer.model.createMesh(meshData);
    }
}