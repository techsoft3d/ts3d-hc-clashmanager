# Clash Detection for HOOPS Communicator (Beta)

## Overview

This library provides clash detection functionality for HOOPS Communicator, akin to what can be found in Navisworks and other applications. Users can specify a clash tolerance to detect only hard clashes beyond a certain penetration depth as well as a clearance value to find elements that are not clashing but are closer than a specified distance to each other (often referred to as "soft clashes"). Clashes can be computed between all elements within a model or between two distinct sets of elements. The library is optimized for building/AEC type of models (IFC, Revit, NW, DWG), and has not been widely tested with generic "CAD" models.

The library can be used purely client-side, but it also has an optional server-side component that allows for the clash detection to be performed on the server. This is especially useful for very large models as the calculation is performed asynchronously on the server and only the results are sent to the client. 

For questions/feedback please send an email to guido@techsoft3d.com or post in our [forum](https://forum.techsoft3d.com/). For a 60 day trial of the HOOPS Web Platform go to [Web Platform](https://www.techsoft3d.com/products/hoops/web-platform).


## GitHub Project

The public github project can be found here:  
...


## Disclaimer
**This library is not an officially supported part of HOOPS Communicator and provided as-is.**


## Future Plans
* Performance Improvements
* Improved Documentation


## Install
Add `dist/hcClashManager.min.js` to your project 
```
    <script src="./js/hcClashManager.min.js"></script>
```

## Demo

The demo is a "quick and dirty" front-end implementation for the library. It is not meant to be a full-fledged application, but rather a Proof of Concept that showcases the functionality of the library. It can be found in the 'dev/public' folder of the project.

To start the demo with the provided sample model locally when using the Visual Studio Code Live Server plugin use the below URL:
<http://127.0.0.1:5500/dev/viewer.html?scs=models/arboleda.scs>

To start the demo with the clash detection performed server-side:
* Run `npm install` in the root folder of the project
* Run `npm start'` in the root folder of the project to start the server
* Open `dev/public/js/app/startup.js` and change Line 1 so that `serveraddress = "http://127.0.0.1:3000"`;
* Open `http://localhost:3000/viewer.html?scs=models/arboleda.scs` in your browser


All the UI related code can be found in `dev/public/js/app/startup.js`. Feel free to use this code as a starting point for your own implementation. For the UI the demo uses the two projects below for SmartSearch as well as a custom model tree implementation.

https://forum.techsoft3d.com/t/alternative-model-tree/506  
https://forum.techsoft3d.com/t/model-tree-search-revisited/886


## Basic Usage

### Instantiation
```myClashManager = new hcClashManager.ClashManager(hwv);```  
All Initialization should happen *after* the modelStructureReady callback has triggered.


### Intialize Full Clash Detection
```await myClashManager.setFull();```

### Intialize Partial Clash Detection
```await myClashManager.setSourceNodes(nodeids);```  
```await myClashManager.setTargetNodes(nodeids);```  
This will clash-test all source nodes (and their children) with all target nodes (and their children).To switch back to full clash detection call `await myClashManager.setFull();` again.

### Exclude Nodes from Clash Detection
```await myClashManager.setExluceNodes(nodeids);```  
All nodes passed into this function (including their children) will be excluded from the clash detection calculation. Pass an empty array to reset the list of excluded nodes.  

### Perform Clash Detection
```let clashResults = await myClashManager.calculateClashes();```  
`clashResults` is an array of all found clashes. Each clashobject has the following properties:  
**nodeid1**: number, the nodeid of the first element involved in the clash
**nodeid2**: number, the nodeid of the second element involved in the clash
**isClash**: boolean, true if the two elements are clashing (a hard clash)  
**isWithinClearance**: boolean, true if the two elements are within the specified clearance distance (a soft clash)  
**isTouching**: boolean, true if the two elements are touching  
**distance**: number, the distance between the two elements, negative if elements are clashing  

### Settings
The below settings can be modified before calling `await myClashManager.calculateClashes();` without the need to reinitialize the library. All functions have equivalent getter functions.  

```myClashManager.setTolerance(number);```  
All hard clashes with a penetration depth lower than the specified tolerance will be ignored.  Default: 55 

```myClashManager.setClearance(number);```  
If clearance is > 0, all elements that are not clashing but are closer than the specified clearance distance will be reported as soft clashes. Default:0  

```myClashManager.setSeparationCheck(boolean);```  
If set to true, an extra separation test will be performed. See the Algorithm section for more details. Default: true  

```myClashManager.setInsideCheck(boolean);```  
If set to true, an extra inside test will be performed. See the Algorithm section for more details. Default: false  

```myClashManager.setTouchCheck(boolean);```  
If set to true and the separation check is set to true, an extra touch test will be performed. See the Algorithm section for more details. Default: false  

```myClashManager.setTouchValidation(boolean);```  
If set to true and the extra touch test is set to true, an extra validation step will be performed to determine if the items are touching. See the Algorithm section for more details. Default: false  

```myClashManager.setIgnoreSpaces(boolean);```  
This setting only applies to IFC models. If set to true, all spaces geometry will be ignored. Default: true  

```myClashManager.setProgressCallback(func);```  
An optional callback can be provided to receive progress updates during the clash detection. The callback function will receive the number of elements that have been processed so far (starting with 0)  as well as the total number of elements. After the clash detection has finished the callback will be called with a value of -1 for the first parameter.

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

## Algorithm
The basic algorithm used for clash detection in this library, tests parts vs parts for triangle/triangle intersections. A part might consist of multiple bodies, those will be regarded as a single entity and not tested amongst each other. If an intersection has been found a negative penetration distance will be calculated. The (negative) number returned should be similar to the one calculated by Navisworks, and is merely a rough approximation/guidance that only considers individual triangles.  

There are some cases (e.g. entities with the same dimensions that are partially overlapping in only one dimension) where the penetration depth will be reported as 0 (or very close to 0). In order to improve on this, an additional separation check can be performed (```setSeparationCheck(true)```, true by default). This test performs a more elaborate calculation to test if two objects can be separated given the provided tolerance. If this test is active, even if the calculated penetration depth is lower than the provided tolerance value, the two objects will still be included in the clash list. To improve on this calculation even further, an additional test can be performed (```setTouchCheck(true)```, false by default) which can be further validated (```setTouchValidation(true)```, false by default) to determine if the two objects are actually touching. These calculation increase the accuracy of the test but come at the expense of performance.  

In addition to the above, an optional inside test can be performed (```setInsideCheck(true)```, false by default). This test will check if one object is completely inside another object.  

When setting a clearance value, please keep in mind that this calculation is more time-consuming, especially for larger clearance values and is performed as a separate step.


## Server-side Clash Detection
While the Clash Detection calculation is relatively fast, it can be benficial to perform the calculation server side. Reasons for this are:

* The model is very large and the calculation takes too long. While the clash detection is non-blocking it will slow down the viewer overall if performed client-side
* The user is running on a lower-end device with limited memory/CPU capacity
* Your application is using Stream Cache Streaming or Server-side Rendering. Due to the fact that some or all of the geometry is left on the server in those modes and needs to be individually requested by the clash detection library, initial performance will be very slow if the library is used client-side.

### Simple Configuration
To perform the clash detection server-side, the following steps are required (assuming a Node.js application)
* Install the server-side component by running `npm install ts3d-hc-clashmanager`
* Add the following code to your server-side application. This will start the clashManager on port 3000. If you want to use a different port, you can pass in a configuration object as a parameter to the startServer function. See the next section for more information.
    ```
    const clashmanager = require('ts3d-hc-clashmanager');
    clashmanager.startServer() 
    ```

* In your client-side application, call the initializeServer function right after you instantiate the clash manager:
    ```
    myClashManager.initializeServer(http://127.0.0.1:3000","arboleda.scs");
    ```
    This will run the clash detection library in server-side mode and initiate loading of the referenced scs model on the server. Obviously, this file needs to be accessible on the server and the viewer needs to have loaded this model already. If you are using Stream Cache Streaming, you will need to also generate an SCS file during initial conversion of your model. By default this model will be accessed by the server from the `dev/public/models` directory of your project. See below for changing the default location

* If your server is running, the client library will now automatically communicate with the clash detection server and perform the calculations there. 


### Advanced Configuration
You can pass a configuration object to the startServer function to change the defaults of the server. This allows you to set the port for the clash server as well as the location it will look for scs files.
 ```
 let config = {
    "port": "3005",
    "modelLocation": "c:/mymodels"
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
Those functions take either a fully qualifed path to an scs file or a binary blob containing the scs file data. After the new session has been created, the functions will return a sessionid, you can then pass to the client library. In this scenario, you won't call the initializeServer function mentiond above, but instead pass the existing sessionid to the client library with the following function:
```
myClashManager.initializeExistingServerSession("http://127.0.0.1:3000",sessionid);
```

In addition, you might also want to use a proxy to control access to the clash server REST api. Each clash related API call to the server is prefixed with `hcClash` in the URL. It is also possible to use the REST API directly and bypass the client-side library completely. Documentation of the REST API will be added in the future, though feel free to parouse the code in `server\app.js.`




## Acknowledgments
### Demo:
* [GoldenLayout](https://golden-layout.com/)
* [Tabulator](http://tabulator.info/)
* [jsTree](https://www.jstree.com/)


