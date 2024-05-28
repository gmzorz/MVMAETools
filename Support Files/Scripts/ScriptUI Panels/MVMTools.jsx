function AddCam(thisObj) {
	var name = "AddCam";
	var version = 1.1;

	function buildUI(thisObj) {
		var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette", name + " " + version, undefined, { resizeable: true });

		res = "group\
            {\
                orientation:'column',  alignment:['fill','center'], alignChildren:['fill','fill'],\
                groupZero: Group\
                {\
                    orientation:'column', alignChildren:['fill','center'],\
                    buttonAdd: Button{text: 'Import Camera'}\
                }\
				groupOne: Group\
                {\
                    orientation:'column', alignChildren:['fill','center'],\
                    buttonAdd: Button{text: 'Convert HSV Depthpass'}\
                }\
                groupTwo: Group\
                {\
                    orientation:'column',\
                    staticText1: StaticText{text: 'http://codmvm.com/'},\
					staticText2: StaticText{text: 'http://gmzorz.com/MVMAETools'},\
					staticText3: StaticText{text: 'IW3 Depth at black: 4080'},\
                }\
            }";

		myPanel.grp = myPanel.add(res);

		myPanel.layout.layout(true);
		myPanel.grp.minimumSize = myPanel.grp.size;

		myPanel.layout.resize();
		myPanel.onResizing = myPanel.onResize = function () {
			this.layout.resize();
		}

		myPanel.grp.groupZero.buttonAdd.onClick = function () {
			AddCamToLayer();
		}

		myPanel.grp.groupOne.buttonAdd.onClick = function () {
			patchHSVDepth();
		}

		myPanel.layout.layout(true);
		return myPanel;
	}

	function createSun(worldLayer) {
		var sunName = "IW3_SUN3D: " + worldLayer.name;
		var existingSun = app.project.activeItem.layers.byName(sunName);

		// If the sun already exists, add an index to create a new unique sun
		if (existingSun) {
			var index = 1;
			// Increase index until a unique sun name is found
			while (app.project.activeItem.layers.byName(sunName + " (" + index + ")")) {
				index++;
			}
			sunName += " (" + index + ")";
		}

		// Create a new null layer if no sun layer is found
		var outSun = app.project.activeItem.layers.addNull();
		outSun.name = sunName;
		outSun.threeDLayer = true;
		outSun.startTime = worldLayer.startTime;
		outSun.inPoint = worldLayer.inPoint;
		outSun.outPoint = worldLayer.outPoint;

		// Add a color control effect and set its name
		var colorControl = outSun.property("Effects").addProperty("Color Control");
		colorControl.name = "Sun Color";

		return outSun;
	}

	function createCamera(worldLayer) {
		var camName = "IW3_CAM3D: " + worldLayer.name;
		var existingCam = app.project.activeItem.layers.byName(camName);

		// If the camera already exists, add an index to create a new unique camera
		if (existingCam) {
			var index = 1;
			// Increase index until a unique camera name is found
			while (app.project.activeItem.layers.byName(camName + " (" + index + ")")) {
				index++;
			}
			camName += " (" + index + ")";
		}

		// Create a new camera layer
		var outCam = app.project.activeItem.layers.addCamera("tmp", [app.project.activeItem.width / 2, app.project.activeItem.height / 2]);
		outCam.name = camName;
		outCam.startTime = worldLayer.startTime;
		outCam.inPoint = worldLayer.inPoint;
		outCam.outPoint = worldLayer.outPoint;
		return outCam;
	}

	function patchHSVDepth() {
		app.beginUndoGroup("Patch HSV");
		if (app.project.bitsPerChannel == 8) {
			alert("To ensure maximum accuracy, please set your project color depth to 16BPC or higher");
		}

		var worldLayer = app.project.activeItem.selectedLayers[0];
		var effect = worldLayer.property("Effects").addProperty("Shift Channels");
		effect.property("Take Red From").setValue(6);
		effect.property("Take Green From").setValue(6);
		effect.property("Take Blue From").setValue(6);
		var newComp = app.project.activeItem.layers.precompose([worldLayer.index], worldLayer.name, true);
		app.endUndoGroup();
	}

	function AddCamToLayer() {
		app.beginUndoGroup("Adding Camera"); // Start an undo group to bundle all actions into one undo step
		// -------------------Selected layer-------------------
		// Check if only a source layer is selected
		var selectedLayers = app.project.activeItem.selectedLayers; // Get all selected layers in the active composition
		if (selectedLayers.length === 0) { // Check if no layers are selected
			alert("No layer selected, please select a source layer."); // Alert if no layer is selected
			return; // Exit the function if no layer is selected
		} else if (selectedLayers.length > 1) { // Check if more than one layer is selected
			alert("Multiple layers selected, please select only a source layer."); // Alert if more than one layer is selected
			return; // Exit the function if more than one layer is selected
		}
		// Check if selected layer is a video
		if (selectedLayers[0].source == undefined || selectedLayers[0].source.frameRate == 0 || selectedLayers[0].source.duration == 0) {
			alert("Selected layer isn't a video, please select a source layer."); // Alert if the layer does not have a source
			return; // Exit the function if the layer does not have a source
		}

		// Define the selected layer
		var worldLayer = selectedLayers[0]; // Get the first (and only) selected layer

		// -------------------Selected file-------------------
		// Read MVM file
		var mvmFile = File.openDialog(); // Open file dialog to select a file
		if (!mvmFile || !mvmFile.open("r")) { // Check if the file was opened successfully
			alert("Failed to open file."); // Alert if the file failed to open
			return; // Exit the function if file opening failed
		}

		// Check the file extension
		var fileExtension = mvmFile.name.split('.').pop(); // Get the file extension from the file name
		if (fileExtension.toLowerCase() !== "aecam") {
			alert("Incorrect file extension: ." + fileExtension + "\nPlease, select an .AECAM file.");
			return;
		}

		// Split file content into lines
		var mvmLines = mvmFile.read().split("\n"); // Read the file content and split it into lines
		mvmFile.close(); // Close the file after reading

		// Check the version
		var headerLine = mvmLines[0]; // Retrieve the first line from the read file data
		var splitHeader = headerLine.split(' '); // Split the first line into parts
		if (parseFloat(splitHeader[2]) != version) {
			alert("Version mismatch: File version " + parseFloat(splitHeader[2]) + " vs Script version " + version + "\nVisit: http://gmzorz.com/MVMAETools");
			return;
		}
		// -------------------Frames checker-------------------
		var numFrames = parseInt(mvmLines[1].split(' ')[0]); // Parse the number of frames from the second line
		var frameRate = worldLayer.source.frameRate; // Get the frame rate of the source of the selected layer
		var duration = worldLayer.source.duration; // Get the duration of the source of the selected layer

		var calculatedFrames = Math.round(duration * frameRate); // Calculate the expected number of frames based on duration and frame rate
		if (Math.abs(numFrames - calculatedFrames) > 1) { // Compare the length of the file to the length of the layer
			var continueScript = confirm("Frame duration mismatch.\n\nFile frames: " + numFrames + "\nComposition frames: " + calculatedFrames + " (Duration: " + duration.toFixed(2) + "s, Frame rate: " + frameRate + "fps)\n\n1. Select a correct source layer.\n2. Open correct camera data file for your cinematic.\n\nDo you want to continue anyway?");
			if (!continueScript) {
				return; // Exit the function if the user chooses not to continue
			}
			// Otherwise, continue with the rest of the script
		} else {
			// Check if time remapping is applied to the layer
			if (worldLayer.timeRemapEnabled) {
				var continueScript = confirm("Error: Seems like you chose the right camera data, but because time remapping is applied to the selected layer, your camera data won't match the video. Please, remove time remapping from the selected layer.\n\nIf you have camera time remapping script, ignore the warning and press yes.\n\nIgnore the warning?");
				if (!continueScript) {
					return; // Exit the function if the user chooses not to continue
				}
			}
		}
		// -------------------Objects creator-------------------
		// Create camera
		var mvmCam = createCamera(worldLayer); // Create a camera based on the selected layer
		var positions = []; // Initialize an array to store position keyframes
		var pointsOfInterest = []; // Initialize an array to store point of interest keyframes
		var rotationsZ = []; // Initialize an array to store rotation keyframes
		var zooms = []; // Initialize an array to store zoom keyframes
		var times = []; // Initialize an array to store time for each keyframe
		var skippedFramesCam = 0; // Initialize a counter for skipped frames

		// Create a sun if sun data exists
		for (var j = 3; j < 10 && j < mvmLines.length; j++) { // Create a sun if "3DSUN" is found in lines from 4 to 10
			var currentLine = mvmLines[j];
			//alert("Processing line " + j + ": " + currentLine + " (type: " + typeof currentLine + ")");
			if (currentLine && typeof currentLine === "string" && currentLine.indexOf("3DSUN") !== -1) {
				var sunObj = null; // Create an empty variable for a sun
				sunObj = createSun(worldLayer); // Create a sun object if the line contains "3DSUN"
				// Create arrays for sun data
				var sunPositions = []; // Initialize an array to store sun position keyframes
				var sunColors = []; // Initialize an array to store sun color keyframes
				var sunTimes = []; // Initialize an array to store time for each sun keyframe
				var skippedFramesSun = 0; // Initialize a counter for skipped frames
				break; // Exit the loop after creating the sun object
			}
		}

		// -------------------Data converter-------------------
		for (var i = 2; i < mvmLines.length; i++) { // Loop through the lines starting from the third line
			var splitStr = mvmLines[i].split(' '); // Split the line into components
			if (splitStr[0] === "3DCAM") {
				var frameIndex = worldLayer.startTime * frameRate + i - 2 - skippedFramesCam; // Calculate the frame index accounting for skipped frames
				var time = frameIndex / frameRate; // Calculate the time for the keyframe

				var posX = -parseFloat(splitStr[1]); // Parse and negate the X position
				var posY = -parseFloat(splitStr[3]); // Parse and negate the Y position
				var posZ = -parseFloat(splitStr[2]); // Parse and negate the Z position
				var lookAtX = posX - parseFloat(splitStr[4]); // Calculate the X coordinate for the point of interest
				var lookAtY = posY - parseFloat(splitStr[6]); // Calculate the Y coordinate for the point of interest
				var lookAtZ = posZ - parseFloat(splitStr[5]); // Calculate the Z coordinate for the point of interest
				var roll = parseFloat(splitStr[7]); // Parse the roll rotation
				var fovH = app.project.activeItem.width / parseFloat(splitStr[8]); // Calculate the horizontal field of view

				positions.push([posX, posY, posZ]); // Add the position to the positions array
				pointsOfInterest.push([lookAtX, lookAtY, lookAtZ]); // Add the point of interest to the pointsOfInterest array
				rotationsZ.push(roll); // Add the roll to the rotationsZ array
				zooms.push(fovH); // Add the field of view to the zooms array
				times.push(time); // Add the time to the times array
			} else {
				skippedFramesCam++; // Increment skipped frames counter if the line is skipped
			}

			if (splitStr[0] === "3DSUN") {
				var sunFrameIndex = worldLayer.startTime * frameRate + i - 2 - skippedFramesSun; // Calculate the frame index accounting for skipped frames
				var sunTime = sunFrameIndex / frameRate; // Calculate the time for the keyframe
				var sunPosX = -parseFloat(splitStr[1]) * 1000 + posX;
				var sunPosY = parseFloat(splitStr[2]) * 1000 + posY;
				var sunPosZ = -parseFloat(splitStr[3]) * 1000 + posZ;
				var sunColR = parseFloat(splitStr[4]) / 255.0;
				var sunColG = parseFloat(splitStr[5]) / 255.0;
				var sunColB = parseFloat(splitStr[6]) / 255.0;
				var sunCol = [sunColR, sunColG, sunColB, 1]; // RGBA color

				sunPositions.push([sunPosX, sunPosY, sunPosZ]); // Add the sun position to the sunPositions array
				sunColors.push(sunCol); // Add the sun color to the sunColors array
				sunTimes.push(sunTime); // Add the time to the sunTimes array
			} else {
				skippedFramesSun++; // Increment skipped frames counter if the line is skipped
			}

		}

		// -------------------Converted data applier-------------------
		// -------------------Camera-------------------
		mvmCam.position.setValuesAtTimes(times, positions); // Set position keyframes for the camera
		mvmCam.pointOfInterest.setValuesAtTimes(times, pointsOfInterest); // Set point of interest keyframes for the camera
		mvmCam.rotationZ.setValuesAtTimes(times, rotationsZ); // Set rotation keyframes for the camera
		mvmCam.zoom.setValuesAtTimes(times, zooms); // Set zoom keyframes for the camera

		// -------------------Camera center null-------------------
		// Calculate the average position
		var avgPos = [0.0, 0.0, 0.0];
		for (var k = 0; k < positions.length; k++) {
			avgPos[0] += positions[k][0];
			avgPos[1] += positions[k][1];
			avgPos[2] += positions[k][2];
		}
		avgPos[0] /= positions.length;
		avgPos[1] /= positions.length;
		avgPos[2] /= positions.length;

		// Create a null object at the center of the camera path
		var centerNullName = "IW3_CENTER: " + worldLayer.name;
		var existingCenterNull = app.project.activeItem.layers.byName(centerNullName);

		// If the IW3_CENTER null already exists, add an index to create a new unique IW3_CENTER null
		if (existingCenterNull) {
			var indexCenter = 1;
			// Increase index until a unique IW3_CENTER null name is found
			while (app.project.activeItem.layers.byName(centerNullName + " (" + indexCenter + ")")) {
				indexCenter++;
			}
			centerNullName += " (" + indexCenter + ")";
		}

		var centerNull = app.project.activeItem.layers.addNull();
		centerNull.name = centerNullName;
		centerNull.threeDLayer = true;
		centerNull.startTime = worldLayer.startTime;
		centerNull.inPoint = worldLayer.inPoint;
		centerNull.outPoint = worldLayer.outPoint;
		centerNull.position.setValue(avgPos); // Set the position of the null object to the average point

		// -------------------Sun 3d null-------------------
		// Set keyframes for the sun if it exists
		if (sunObj) {
			sunObj.position.setValuesAtTimes(sunTimes, sunPositions); // Set position keyframes for the sun
			sunObj.property("Effects").property("Sun Color").property("Color").setValuesAtTimes(sunTimes, sunColors); // Set color keyframes for the sun
			// -------------------Sun 2d null-------------------
			// Create a 2D null object
			var null2DName = "IW3_SUN2D: " + worldLayer.name;
			var existingNull2D = app.project.activeItem.layers.byName(null2DName);

			// If the 2D null already exists, add an index to create a new unique 2D null
			if (existingNull2D) {
				var index2D = 1;
				// Increase index until a unique 2D null name is found
				while (app.project.activeItem.layers.byName(null2DName + " (" + index2D + ")")) {
					index2D++;
				}
				null2DName += " (" + index2D + ")";
			}

			var null2D = app.project.activeItem.layers.addNull();
			null2D.name = null2DName;
			null2D.threeDLayer = false; // Ensure the layer is 2D
			null2D.startTime = worldLayer.startTime;
			null2D.inPoint = worldLayer.inPoint;
			null2D.outPoint = worldLayer.outPoint;

			// Expression to link the 2D null object to the 3D sun position
			var sun2dEx = "src3D = thisComp.layer(\"" + sunObj.name + "\");\n";
			sun2dEx += "src3D.toComp(src3D.transform.anchorPoint);";

			// Apply the expression to the position property of the 2D null object
			null2D.position.expression = sun2dEx;
		}

		app.endUndoGroup(); // End the undo group
	}

	var myScriptPal = buildUI(thisObj);

	if ((myScriptPal != null) && (myScriptPal instanceof Window)) {
		myScriptPal.center();
		myScriptPal.show();
	}

	if (this instanceof Panel)
		myScriptPal.show();
}
AddCam(this);
AddCam.jsx
