# Clash Manager - Clash Detection for HOOPS Communicator (Beta)

## Overview

This library provides clash detection functionality for HOOPS Communicator, akin to what can be found in Navisworks and other applications. Users can specify a clash tolerance to detect only hard clashes beyond a certain penetration depth as well as a clearance value to find elements that are not clashing but are closer than a specified distance to each other (often referred to as "soft clashes"). Clashes can be computed between all elements within a model or between two distinct sets of elements. The code is optimized for building/AEC type of models (IFC, Revit, NW, DWG), and has not been widely tested with generic "CAD" models.

The library can be used purely client-side, but it also has an optional server-side component that allows for the clash detection to be performed on the server with minimal code changes on the client. This is especially useful for very large models as the calculation is performed asynchronously on the server and only the results are sent to the client. 

Clash Detection for HOOPS Communicator is currently in beta. Please report any issues or provide feedback via email (guido@techsoft3d.com) or post in our [forum](https://forum.techsoft3d.com/). For a 60 day trial of the HOOPS Web Platform go to [Web Platform](https://www.techsoft3d.com/products/hoops/web-platform).


## Disclaimer
This library is not an officially supported part of HOOPS Communicator and provided as-is. **However, we are actively evaluating the potential of integrating clash detection as an official feature within the product so please provide feedback if you are interested in this functionality.**

## GitHub Project
The public github project can be found here:  
https://github.com/techsoft3d/ts3d-hc-clashmanager


## Future Plans
* Performance Improvements
* More testing with MCAD models
* Improved Documentation (in particular documentation of REST api)

## Install
Add `dist/hcClashManager.min.js` to your project 
```
    <script src="./js/hcClashManager.min.js"></script>
```

## Demo

The demo is a "quick and dirty" front-end implementation for the library. It is not meant to be a robust, full-fledged application, but rather a practical Proof of Concept that showcases the clash detection functionality. It can be found in the 'dev/public' folder of the project.

To start the demo with the provided sample model locally when using the Visual Studio Code Live Server plugin use the below URL:
<http://127.0.0.1:5500/dev/viewer.html?scs=models/arboleda.scs>

To start the demo with clash detection performed server-side:
* Run `npm install` in the root folder of the project to install dependencies.
* Run `npm start'` in the root folder of the project to start the server.
* Open `dev/public/js/app/startup.js` and change Line 1 so that `serveraddress = "http://127.0.0.1:3000"`.
* Open `http://localhost:3000/viewer.html?scs=models/arboleda.scs` in your browser.

To clash-test other models, simply place your scs files in the `dev/public/models` folder and change the URL accordingly.

All the UI related code can be found in `dev/public/js/app/startup.js`. Feel free to use this code as a reference or starting point for your own implementation. 

The demo utilizes the advanced search and custom model tree functionality from the projects below:
https://forum.techsoft3d.com/t/alternative-model-tree/506  
https://forum.techsoft3d.com/t/model-tree-search-revisited/886 (the updated version of this project used in the demo is not yet available on github, but will be added soon )


## Basic Usage

### Units
The Units for all values passed into the library as well as for the returned clash results are in millimeters. 

### Instantiation

```myClashManager = new hcClashManager.ClashManager(hwv)```  
The function takes the webviewer instance as its only parameter. The library should only be instantiated and used *after* the modelStructureReady callback has triggered. 
If you are loading your models in a delayed fashion (e.g. via loadSubtree..) you should wait until the loadSubtree promise has returned before initializing full or partial clash detection. (it needs to be reinitialized each time adding models have been added)

### Intialize Full Clash Detection
```await myClashManager.setFull()```  
This will initialize the clash-test of all geometry (triangle meshes) in the model against each other that are not part of the set of excluded geometry (see below). This function does not perform the actual clash test, but just sets up the data structures required for the clash detection. To perform the actual clash detection call `myClashManager.calculateClashes()`.

### Intialize Partial Clash Detection
```await myClashManager.setSourceNodes(nodeids)```  
```await myClashManager.setTargetNodes(nodeids)```  
This will initialize the clash-test between geometry of all source nodes (and their children) with the geometry of all target nodes (and their children).To switch back to full clash detection call `myClashManager.setFull()` again. These functions do not perform the actual clash test, but just set up the data structures required for the clash detection. To perform the actual clash detection call `myClashManager.calculateClashes()`. You can call `setSourceNodes` and `setTargetNodes` independetly to update just one of the groups.

**Only triangle meshes will be considered for the clash detection, line or point geometry will be ignored.**

### Exclude Nodes from Clash Detection
```await myClashManager.setExludeNodes(nodeids)```  
All nodes passed into this function (including their children) will be excluded from the clash detection calculation (even if included among the array of source or target nodes). Pass an empty array to reset the list of excluded nodes.  

### Perform Clash Detection
```let clashResults = await myClashManager.calculateClashes();```  
Performs clash detection for all geometry in a model or the nodes included in the source and target nodes (based on previous initialization).  
`clashResults` is an array of all found clashes. Each clashobject has the following properties:  
**nodeid1**: nodeid, the nodeid of the first element involved in the clash  
**nodeid2**: nodeid, the nodeid of the second element involved in the clash  
**isClash**: boolean, true if the two elements are clashing (a hard clash)  
**distance**: number, the distance between the two elements, negative if elements are clashing  
**isWithinClearance**: boolean, true if the two elements are not penetrating but within the specified clearance distance (a soft clash)  
**isTouching**: boolean, true if the two elements are touching (only valid if the touch check is enabled)  

```let clashResults = await myClashManager.calculateClashesForSingleNode(nodeid);```  
Performs clash detection for a single node. 
`clashResults` is an array of all found clashes (same properties as above) 

### Settings
The below settings can be modified before calling `myClashManager.calculateClashes()` without the need to reinitialize the library. All functions have equivalent getter functions.  

```myClashManager.setTolerance(number)```  
All hard clashes with a penetration depth lower than the specified tolerance will be ignored.  Default: 50mm 

```myClashManager.setClearance(number)```  
If clearance is > 0, all elements that are not clashing but are closer than the specified clearance distance will be reported as soft clashes. Default: 0mm 

```myClashManager.setEntitySeparationCheck(boolean)```  
If set to true, an extra entity level separation test will be performed. See the Algorithm section for more details. Default: true  

```myClashManager.setInsideCheck(boolean)```  
If set to true, an extra inside test will be performed. See the Algorithm section for more details. Default: false  

```myClashManager.setTouchCheck(boolean)```  
If set to true and the separation check is set to true, an extra touch test will be performed. See the Algorithm section for more details. Default: false  

```myClashManager.setTouchValidation(boolean)```  
If set to true and the extra touch test is set to true, an extra validation step will be performed to determine if the items are touching. See the Algorithm section for more details. Default: false  

```myClashManager.setIgnoreInvisible(boolean)```  
If set to true, all invisible geometry will be ignored. Default: false
When using server-side clash detection, only the initial visibility configuration of the model will be considered in the current version of the library.

```myClashManager.setIgnoreSpaces(boolean)```  
This setting only applies to IFC models. If set to true, all spaces geometry will be ignored. Default: true  
Make sure to reinitialize the library after changing this setting!

### Other Functions

```myClashManager.setProgressCallback(func);```  
An optional callback can be provided to receive progress updates during clash detection as well as the initialization phase of the library. The callback function will receive the number of elements that have been processed so far (starting with 0) as well as the total number of elements. After the clash detection evalulation has finished the callback will be called with a value of -1 for the first parameter.

```
function progressCallback(current, total) {
    if (current == 0) {
        console.log("Starting clash detection");
    }
    else if (current == -1) {
        console.log("Clash detection finished");
    }
    else {
        console.log("Progress: " + current + " / " + total);
    }
}
```

```myClashManager.invalidateNodes(nodeids)```  
Invalidates the specified nodes. This will updated the clash detection data structures to reflect any changes to the geometry of the specified nodes (e.g. the modelling matrix on the node has changed).

```myClashManager.getVersion()```  
Retrieves the version of the library  


## Algorithm
The basic algorithm used for clash detection in this library tests parts vs parts for triangle/triangle intersections. A part might consist of multiple bodies, those will be regarded as a single entity and not tested amongst each other. If an intersection has been found, a penetration distance will be calculated. The negative number returned should be similar to the one calculated by Navisworks, and is merely a rough approximation/guidance that only considers the separation distance between individual triangles.  

There are some cases (in particular entities with the same dimensions that are partially overlapping in only one dimension) where the penetration depth will be reported as 0 (or very close to 0) or significantly smaller than the "real" penetration depth. In order to improve on this, an additional separation check can be performed (```setEntitySeparationCheck(true)```, true by default). This test performs a more elaborate calculation to test if two objects can be separated given the provided tolerance. If this test is active then even if the calculated penetration depth is lower than the provided tolerance value, the two objects will still be considered as a clash and included in the clash list returned by the `calculateClashes` function. To improve the clash results even further, an additional test can be performed (```setTouchCheck(true)```, false by default) which can be further validated (```setTouchValidation(true)```, false by default) to determine if the two objects are actually touching. These calculation increase the accuracy of the test but come at the expense of performance.  

In addition to the above, an optional inside test can be performed (```setInsideCheck(true)```, false by default). This test will check if one object is completely inside another object. (e.g. a pipe inside a wall). An object found to be completely inside another object will be reported as a hard clash.

When setting a clearance value (```setClearance(500)```), please keep in mind that this calculation is more time-consuming, especially for larger clearance values and is performed as a separate step. If you are only interested in hard clashes, you should set the clearance value to 0 (which is the default). Unlike the penetration depth, the calculated clearance distance should be very accurate.

From a practical perspective, sorting the clash results by penetration depth will yield a rough approximation of clash severity but might miss-classify some severe clashes. To improve the identifcation of the most severe clashes, additional enabling the separation test will make it easier and faster to identify those clashes, especially if there is a lot of them overall. In any case, the separation test is conservative and should not miss clashes that are above the tolerance threshold.


## Server-side Clash Detection
While the Clash Detection calculation is relatively fast, it can be benficial to perform the calculation server side. Reasons for this are:

* The model is very large and the calculation takes too long. While the clash detection is non-blocking it will slow down the viewer overall if performed client-side.
* The user is running on a lower-end device with limited memory/CPU capacity, for example a mobile device or low-end laptop.
* Your application is using Stream Cache Streaming or Server-side Rendering. Due to the fact that some or all of the geometry is left on the server in those modes and needs to be individually requested by the clash detection library, initial performance will be very slow if the library is used client-side.

### Simple Configuration
To perform the clash detection server-side, the following steps are required (assuming a Node.js application)
* Install the server-side component by running `npm install ts3d-hc-clashmanager`.   
  Alternatively, you can also simply start the server from the github project following the same steps used to start the server-side demo (see above). In this case, any configuration changes should be made in the `server\app.js` file directly. The default configuration can be found at the top of that file. If you using that approach you can skip the next step.
* Add the following code to your server-side application. This will start the clashManager on port 3000. If you want to use a different port, you can pass in a configuration object as a parameter to the startServer function. See the next section for more information.
    ```
    const clashmanager = require('ts3d-hc-clashmanager');
    clashmanager.startServer() 
    ```   

* In your client-side application, call the initializeServer function right after you instantiate the clash manager:
    ```
    myClashManager.initializeServer(http://127.0.0.1:3000","arboleda.scs");
    ```
    This will run the clash detection library in server-side mode and initiate loading of the referenced scs model on the server. Obviously, this file needs to be accessible on the server and the viewer needs to have loaded this model already. If you are using Stream Cache Streaming, you will need to also generate an SCS file during initial conversion of your model, as the server-side clash detection library only works with scs files. By default this model will be accessed by the server from the `dev/public/models` directory of your project. See below on how to change the default location

    If your server is running, the client library will now automatically communicate with the clash detection server and perform the calculations there.

* If your clash session has finished, you should shut it down from the client by calling the following function:
    ```
    myClashManager.endSession();
    ```
    This will shut down the server-side session and free up resources on the server. If you don't call this function, the session will be closed automatically after a timeout (e.g. when the client closes the browser tab or the connection to the server is otherwise severed) (default: 60 seconds). 
    
### Advanced Configuration
You can pass a configuration object to the startServer function to change the defaults of the server. This allows you to set the port for the clash server, the location it will look for scs files and the timeout after which a clash session will be closed.
 ```
 let config = {
    "port": "3000",
    "modelLocation": "c:/mymodels",
    "aliveTimeout": 60000
};
const clashmanager = require('ts3d-hc-clashmanager');
await clashmanager.startServer(config) 
```

In a "real" application, the scs file required for the clash calcuation might live in your database or another location, like an Amazon S3 bucket. In that case, the library should not (and cannot) directly access those files. Instead, when you start a clash session, you have to use one of the functions below to pass the scs file to the server (after calling startServer)

```
let sessionid = await clashmanager.createSessionFromFile("c:/mymodels/arboleda.scs");
```
or
```
let sessionid = await clashmanager.createSessionFromData(scsblob);
```
Those functions take either a fully qualifed path to an scs file or a binary blob containing the scs file data. After the new session has been created, the functions will return a sessionid, you can then pass to the client library. In this scenario, you should not call the initializeServer function mentiond above on the client, but instead pass the existing sessionid to the client library with the following function:
```
myClashManager.initializeExistingServerSession("http://127.0.0.1:3000",sessionid);
```

After a session is done, you have the option to close the session server-side by calling the following function, which will free up resources on the server. If you don't call this function, the session will be closed automatically (after a timeout), when the client disconnects (default: 60 seconds). 
```
await clashmanager.endSession(sessionid);
```

In addition, you might also want to use a proxy to control access to the clash server REST api, and ensure that all traffic goes through a standard port. Each clash related API call to the server is prefixed with `hcClash` in the URL which you can use to redirect traffic to the clash library. It is also possible to use the REST API directly and bypass the client-side library completely. Documentation of the REST API will be added in the future, though feel free to parouse the code in `server\app.js.`

### Typical Server-Side Production Workflow
The typical workflow for server-side clash detection would be to run the clash detection server on its own instance. If a user wants to perform clash detection your backend would then pull out the relevant scs file from your storage, create a new clash session server-side, and send the session id to the client so that the client-library can connect to the session. All this would be controlled via a proxy that ensures session integrity and security and handles potential load-balancing. Please keep in mind that each clash session can use a significant amount of memory on the server as well as CPU resources so you should limit the number of concurrent sessions per server to a reasonable amount based on the underlying hardware.

### Limitations
Adding additional models to an existing clash session is currently not supported when using server-side clash detection. In addition, any changes to the model loaded on the client (e.g. changing visibility, moving parts, etc.) will not be reflected in the clash results in that mode. 

## Acknowledgments
### Demo:
* [GoldenLayout](https://golden-layout.com/)
* [Tabulator](http://tabulator.info/)
* [jsTree](https://www.jstree.com/)