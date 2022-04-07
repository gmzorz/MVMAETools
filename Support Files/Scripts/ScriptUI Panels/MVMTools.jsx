function AddCam(thisObj)
{
    var name = "AddCam";
    var version = 1.1;

    function buildUI(thisObj)
    {
        var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette", name + " " + version, undefined, {resizeable:true});
        
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
        myPanel.onResizing = myPanel.onResize = function()
        {
            this.layout.resize();
        }

        myPanel.grp.groupZero.buttonAdd.onClick = function()
        {
            AddCamToLayer();
        }
		
		myPanel.grp.groupOne.buttonAdd.onClick = function()
        {
            patchHSVDepth();
        }

        myPanel.layout.layout(true);
        return myPanel;    
    }

	function createSun(worldLayer)
	{
		var outSun = app.project.activeItem.layers.addNull([10]);
		outSun.property("Effects").addProperty("Color Control");
		outSun.startTime = worldLayer.startTime;
		outSun.outPoint = worldLayer.outPoint;
		outSun.threeDLayer = true;
		outSun.name = "IW3_SUN3D: " + worldLayer.name;
		return outSun;
	}

	function createCamera(worldLayer)
	{
		var outCam = app.project.activeItem.layers.addCamera("tmp",[app.project.activeItem.width / 2, app.project.activeItem.height / 2,]);
		outCam.name = "IW3_CAM3D: " + worldLayer.name;
		outCam.startTime = worldLayer.startTime;
		outCam.outPoint = worldLayer.outPoint;
		return outCam;
	}
	
	function patchHSVDepth()
	{
		app.beginUndoGroup("Patch HSV");
		if (app.project.bitsPerChannel == 8)
		{
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

    function AddCamToLayer()
    {
        app.beginUndoGroup("Adding Camera");

        var splitStr;
		var sunObj = null;
		var sunObj2d = null;
		var mvmCam = null;
		var playerPos = [0.0, 0.0, 0.0];
		var playerLookAt = [0.0, 0.0, 0.0];
		var playerRoll = 0.0;
		var playerFovH = 0.0;
		var sunPos = [0.0, 0.0, 0.0];
		var sunCol = [0.0, 0.0, 0.0];

		/* selected layer protection */
		if (app.project.activeItem.selectedLayers.length > 1)
		{
			alert("Please select a single layer.");
			throw("Please select a single layer.");
		}

		var worldLayer = app.project.activeItem.selectedLayers[0];
		if (worldLayer == null)
		{
			alert("No layer selected, please select a corresponding codmvm layer.");
			throw("Please select a single layer.");
		}

		/* open file */
		var mvmFile = File.openDialog();
		mvmFile.open();

		/* read header */
		var mvmLine;
		mvmLine = mvmFile.readln();
		splitStr = mvmLine.split(' ');
		if (parseFloat(splitStr[2]) != version)
			alert("VERSION MISMATCH, VISIT: http://gmzorz.com/MVMAETools");
		
		mvmLine = mvmFile.readln();
		splitStr = mvmLine.split(' ');
		var numFrames = parseInt(splitStr[0]);
		if ((worldLayer.source.duration * worldLayer.source.frameRate) - numFrames > 1) 
		{
			alert("Frame duration of source footage and campath is not the same (wrong campath?): " + numFrames + " - " + worldLayer.source.duration * worldLayer.source.frameRate);
             
			throw("Error\n");
		}

		var delim = worldLayer.outPoint - worldLayer.startTime;
		var frameCount = worldLayer.source.frameRate * worldLayer.source.duration;

		var i = 0.0;//-(delim / frameCount);
		var centerNull;
		var avgPos = [0.0, 0.0, 0.0];
		while (!mvmFile.eof) 
		{
			mvmLine = mvmFile.readln();
			splitStr = mvmLine.split(' ');
			if (splitStr[0] == "3DCAM")
			{
				if (mvmCam == null)
				{
					mvmCam = createCamera(worldLayer);
					centerNull = app.project.activeItem.layers.addNull([10]);
					centerNull.name = "IW3_SCENE_CENTER";
					centerNull.threeDLayer = true;
				}
				else
				{
					i += (delim / frameCount);
				}
				playerPos[0] = -parseFloat(splitStr[1]);
				playerPos[1] = -parseFloat(splitStr[3]);
				playerPos[2] = -parseFloat(splitStr[2]);
				avgPos += playerPos;
				playerLookAt = playerPos - [parseFloat(splitStr[4]), parseFloat(splitStr[6]), parseFloat(splitStr[5])];
				playerFovH = app.project.activeItem.width / splitStr[8];
				playerRoll = parseFloat(splitStr[7]);
				mvmCam.position.setValueAtTime(i, playerPos);
				mvmCam.pointOfInterest.setValueAtTime(i, playerLookAt);
				mvmCam.rotationZ.setValueAtTime(i, playerRoll);
				mvmCam.zoom.setValueAtTime(i, playerFovH);
			}
			else if (splitStr[0] == "3DSUN")
			{
				if (sunObj == null)
				{
					sunObj = createSun(worldLayer);
					sunObj.property("Effects").property("Color Control").name = "Sun Color";
				}
				sunPos[0] = -parseFloat(splitStr[1]) * 1000 + playerPos[0];
				sunPos[1] = parseFloat(splitStr[2]) * 1000 + playerPos[1];
				sunPos[2] = -parseFloat(splitStr[3]) * 1000 + playerPos[2];
				sunCol[0] = parseFloat(splitStr[4]) / 255.0;
				sunCol[1] = parseFloat(splitStr[5]) / 255.0;
				sunCol[2] = parseFloat(splitStr[6]) / 255.0;
				sunObj.property("Effects").property("Sun Color").Color.setValueAtTime(i, sunCol);
				sunObj.position.setValueAtTime(i, sunPos);
				
                  
			}
		}
		avgPos /= numFrames;
		
		centerNull.startTime = worldLayer.startTime;
		centerNull.outPoint = worldLayer.outPoint;
		centerNull.position.setValue([avgPos[0], avgPos[1], avgPos[2]]);
		/* create 2d null based on 3d tracked sun */
		if (sunObj != null)
		{  
			sunObj2d = app.project.activeItem.layers.addNull([10]);
			sunObj2d.name = "IW3_SUN2D: " + worldLayer.name;
			sunObj2d.startTime = worldLayer.startTime;
			sunObj2d.outPoint = worldLayer.outPoint;
			var sun2dEx = "src3D = thisComp.layer(\"" + sunObj.name + "\");\
		src3D.toComp(src3D.transform.anchorPoint)";
			sunObj2d.position.expression = sun2dEx;
		}

		mvmFile.close();
        app.endUndoGroup();
    }

    var myScriptPal = buildUI(thisObj);
   
    if((myScriptPal != null) && (myScriptPal instanceof Window))
    {
        myScriptPal.center();
        myScriptPal.show();
    }   
    
    if(this instanceof Panel)
        myScriptPal.show();  
}
AddCam(this);
AddCam.jsx