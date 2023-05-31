let defaultConfigs = {
    "port": "3000",
    "modelLocation": ""
};

const path = require('path');
const imageservice = require('ts3d-hc-imageservice');

const express = require('express');
const { v4: uuidv4 } = require('uuid');

let pendingClashes = [];



exports.createSessionFromFile = async function (filepath) {
    let uv4 = uuidv4();
    await imageservice.generateImage(filepath,{ evaluate: true, cacheID: uv4 });
    return uv4;
}

exports.createSessionFromData = async function (data) {
    let uv4 = uuidv4();
    await imageservice.generateImage(filepath,{ evaluate: true, cacheID: uv4,scsData:data });
    return uv4;
}


exports.startServer = async function (config) {
   
    async function _cmSetFull() {
        await myClashManager.setFull();
    }
    
    async function _cmSetSourceNodes(nodeids) {
        await myClashManager.setSourceNodes(nodeids);
    }
   
    async function _cmSetTargetNodes(nodeids) {
        await myClashManager.setTargetNodes(nodeids);
    }

    async function _cmSetExcludeNodes(nodeids) {
        myClashManager.setExcludeNodes(nodeids);
    }

    async function _cmClearExcludeNodes(nodeids) {
        myClashManager.setExcludeNodes(nodeids);
    }
   

    async function _cmCheckAgainstNode(nodeid) {
        let result = await myClashManager.checkAgainstNode(nodeid);
        return result
    }

    async function _cmSetSettings(settings) {
        myClashManager.applySettings(settings);
    }

    function _cmProgress() {
        return ({currentProgress:currentProgress,totalProgress:totalProgress});
    }

    async function _newClash(sessionid) {

        async function _cmCalculateClashes() {
            let res = await myClashManager.calculateClashes(false);
            return res;
        }

        pendingClashes[sessionid] = { status: "pending" };
        let result = await imageservice.generateImage(null,{ callback: _cmCalculateClashes,evaluate: true, cacheID: sessionid });
        pendingClashes[sessionid] = { status: "done",result:result };
    }


    const app = express();
    const router = express.Router();
    const cors = require('cors');
    const bodyParser = require('body-parser');   

    app.use(cors());
    app.use(express.json({ limit: '25mb' }));
    app.use(express.urlencoded({ limit: '25mb', extended: false }));
    app.use(express.static(path.join(__dirname, '../dev/public')));

    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());
    await imageservice.start({customViewerDirectory:path.join(__dirname, 'cviewer')});

    router.put('/start/:modelname', async function (req, res, next) {
        let uv4 = uuidv4();
        let modelLocation = config ? config.modelLocation : defaultConfigs.modelLocation;
        if (!modelLocation) {
            modelLocation = path.join(__dirname, "../dev/public/models");
        }
        await imageservice.generateImage(path.join(modelLocation, req.params.modelname),{ evaluate: true, cacheID: uv4 });
        res.json({sessionID:uv4});
    });

    router.get('/calculateClashes/:sessionid', async function (req, res, next) {
        _newClash(req.params.sessionid);
        res.sendStatus(200);
    });

    router.get('/getPendingClash/:sessionid', async function (req, res, next) {
        let result = pendingClashes[req.params.sessionid];
        if (result.status == "done") {
            delete pendingClashes[req.params.sessionid];
            res.json({status:"done",result:result.result});   
        }
        else {
            let result = await imageservice.generateImage(null,{ callback: _cmProgress,evaluate: true, cacheID: req.params.sessionid });
            res.json({status:"pending", currentProgress:result.currentProgress,totalProgress:result.totalProgress});
        }
    });

    router.get('/checkAgainstNode/:sessionid/:nodeid', async function (req, res, next) {
        let result = await imageservice.generateImage(null,{ callback: _cmCheckAgainstNode,callbackParam: parseInt(req.params.nodeid),evaluate: true, cacheID: req.params.sessionid });
        res.json(result);
    });

    router.put('/setFull/:sessionid', async function (req, res, next) {
        await imageservice.generateImage(null,{ callback: _cmSetFull,evaluate: true, cacheID: req.params.sessionid });
        res.sendStatus(200);
    });

    router.post('/setSourceNodes/:sessionid', async function (req, res, next) {
        await imageservice.generateImage(null,{ callback: _cmSetSourceNodes,callbackParam:req.body,evaluate: true, cacheID: req.params.sessionid });
        res.sendStatus(200);
    });

    router.post('/setTargetNodes/:sessionid', async function (req, res, next) {
        await imageservice.generateImage(null,{ callback: _cmSetTargetNodes,callbackParam:req.body,evaluate: true, cacheID: req.params.sessionid });
        res.sendStatus(200);
    });

    
    router.post('/setExcludeNodes/:sessionid', async function (req, res, next) {
        await imageservice.generateImage(null,{ callback: _cmSetExcludeNodes,callbackParam:req.body,evaluate: true, cacheID: req.params.sessionid });
        res.sendStatus(200);
    });

    router.put('/clearExcludeNodes/:sessionid', async function (req, res, next) {
        await imageservice.generateImage(null,{ callback: _cmClearExcludeNodes,evaluate: true, cacheID: req.params.sessionid });
        res.sendStatus(200);
    });

    router.post('/setSettings/:sessionid', async function (req, res, next) {
        await imageservice.generateImage(null,{ callback: _cmSetSettings,callbackParam:req.body,evaluate: true, cacheID: req.params.sessionid });
        res.sendStatus(200);
    });


    app.use("/hcClash", router);
    app.listen(config ? config.port : defaultConfigs.port);

    console.log("ClashManager Server Started");

};


// async function func1() {
//     await myClashManager.setFull();
// }

// async function func2(id) {
//     let res =  await myClashManager.calculateClashes();    
//     return res;
// }

// (async () => {
//     let uv4 = uuidv4();
//     await imageservice.start({customViewerDirectory:path.join(__dirname, 'cviewer')});
//     await imageservice.generateImage("e:/communicator/HOOPS_Communicator_2023_SP1/quick_start/converted_models/standard/scs_models/arboleda.scs",
//         { evaluate: true, cacheID: uv4 });
//         console.log("init done1");
//         await imageservice.generateImage(null,
//         { callback: func1,evaluate: true, cacheID: uv4 });
//         console.log("init done2");
//         let res = await imageservice.generateImage(null,
//         { callback: func2,evaluate: true, cacheID: uv4 });
//         console.log(res.length)
        
//         await imageservice.shutdown();
// })();



if (require.main === module) {
    this.startServer();
} 