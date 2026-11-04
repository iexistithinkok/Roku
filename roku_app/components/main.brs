'===============================================================================
' main.brs
' Entry point for the Roku application.
' This function is called by the Roku firmware to start your app.
'===============================================================================

Sub Main()
    ' Create the root screen
    screen = CreateObject("roScreen", "single")
    screen.SetMessagePort(CreateObject("roMessagePort"))

    ' Create the root node for the UI
    sceneGraph = CreateObject("roSGNode", "Scene")
    scene = sceneGraph.GetRoot()

    ' Create and load the MainScene component
    mainScene = CreateObject("roSGNode", "MainScene")
    scene.AddChild(mainScene)

    ' Show the screen
    screen.Show()

    ' Main event loop
    While True
        msg = Wait(0, screen.GetMessagePort())
        msgType = msg.GetType()
        msgData = msg.GetData()

        If msgType = "roSGScreenEvent" Then
            If msg.isScreenLoaded() Then
                ' The UI has finished loading; continue the event loop
            End If
        End If
    End While
End Sub
