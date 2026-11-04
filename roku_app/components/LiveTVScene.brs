'===============================================================================
' LiveTVScene.brs — Linear TV mode for your Hyperlocal Channel
'
' This turns your video library into a real TV channel:
'   1. Fetch today's schedule from Cloudflare Worker
'   2. Find what program is airing RIGHT NOW
'   3. Play it, then auto-queue the next program
'   4. Show "Now Playing" / "Next Up" overlays
'
' Usage from MainScene:
'   liveScene = CreateObject("roSGNode", "LiveTVScene")
'   mainScene.AddChild(liveScene)
'   liveScene.visible = true
'===============================================================================

Sub Init()
    m.top.functionName = "init"

    m.statusPanel    = m.top.findNode("statusPanel")
    m.nowPlayingLabel  = m.top.findNode("nowPlayingLabel")
    m.nextUpLabel    = m.top.findNode("nextUpLabel")
    m.clockLabel     = m.top.findNode("clockLabel")
    m.loadingPanel   = m.top.findNode("loadingPanel")
    m.loadingText    = m.top.findNode("loadingText")
    m.loadingTimer   = m.top.findNode("loadingTimer")

    m.apiBaseUrl = "https://my-hyperlocal-channel.your-subdomain.workers.dev"
    ' m.apiBaseUrl = "http://192.168.1.100:8787"  ' Local Worker dev URL

    m.videoPlayer = CreateObject("roVideoPlayer")
    m.videoPlayer.observeField("state", "OnVideoState")
    m.videoPlayer.observeField("status", "OnVideoStatus")

    ' Show loading screen
    m.loadingPanel.visible = true

    ' Load the schedule and find what's playing now
    LoadSchedule()

    ' Update the clock every second
    m.clockTimer = CreateObject("roTimer")
    m.clockTimer.duration = 1
    m.clockTimer.observeField("fire", "UpdateClock")
    m.clockTimer.control = "RUN"
End Sub

'-------------------------------------------------------------------------------
' LoadSchedule — Fetch today's schedule, find current program
'-------------------------------------------------------------------------------
Sub LoadSchedule()
    http = CreateObject("roUrlTransfer")
    http.SetUrl(m.apiBaseUrl + "/api/schedule?action=now-playing")
    http.AddHeader("Accept", "application/json")

    jsonText = http.GetToString()

    If jsonText <> "" And jsonText <> Invalid Then
        Try
            data = JsonDecode(jsonText)

            If data.liveEnabled = True And data.currentProgram <> Invalid Then
                StartPlaying(data.currentProgram)
            Else
                ' Live mode is off — fall back to on-demand catalog
                m.loadingText.text = "Live Channel: OFF — Browse content instead"
                Return
            End If
        Catch e As Object
            Print "[LiveTV] Error loading schedule: " + e.ToString()
            m.loadingText.text = "Schedule unavailable. Checking fallback..."
        End Try
    End If

    m.loadingPanel.visible = false
End Sub

'-------------------------------------------------------------------------------
' StartPlaying — Start playing the current schedule entry
'-------------------------------------------------------------------------------
Sub StartPlaying(entry As Object)
    ' Show the "Now Playing" overlay
    ShowNowPlaying(entry)

    ' Create playlist from the schedule entry
    playlist = CreateObject("roArray", 1, true)

    ' Get content metadata if attached
    Dim contentNode As Object
    If entry.content <> Invalid Then
        Dim dict As Object = entry.content
        contentNode = CreateObject("roArray", 1, true)
        Dim item As Object = CreateObject("roAssociativeAA")

        item.url = dict.streamUrl
        item.streamFormat = "hls"
        item.title = dict.title

        ' Add poster if available
        If dict.posterUrl <> "" Then item.posterUrl = dict.posterUrl

        contentNode[0] = item
    Else
        ' Build from schedule entry directly
        contentNode = CreateObject("roArray", 1, true)
        Dim item As Object = CreateObject("roAssociativeAA")

        item.url = entry.streamUrl
        item.streamFormat = "hls"
        item.title = entry.title || entry.contentId || "Program"

        contentNode[0] = item
    End If

    m.videoPlayer.content = contentNode
    m.videoPlayer.Show()

    Print "[LiveTV] Now playing: " + (entry.title || entry.contentId || "?")
End Sub

'-------------------------------------------------------------------------------
' ShowNowPlaying — Display the current program info overlay
'-------------------------------------------------------------------------------
Sub ShowNowPlaying(entry As Object)
    m.statusPanel.visible = true
    m.statusPanel.opacity = 150

    ' "Now Playing" text
    Dim title As String = entry.title || entry.contentId || "Unknown Program"
    Dim category As String = ""

    If entry.category <> "" And entry.category <> "general" Then
        category = " (" + entry.category + ")"
    End If

    If entry.isLive = True Then
        m.nowPlayingLabel.text = "[ LIVE ] " + title + category
    ElseIf entry.isFill = True Then
        m.nowPlayingLabel.text = "[ BREAK ] " + title
    Else
        m.nowPlayingLabel.text = "NOW PLAYING: " + title + category
    End If

    ' "Next Up" — find the next program in today's schedule
    LoadNextProgram(entry)

    ' Schedule a check to reload schedule (in case we miss a transition)
    m.scheduleCheckTimer = CreateObject("roTimer")
    m.scheduleCheckTimer.duration = 30  ' Check every 30 seconds
    m.scheduleCheckTimer.observeField("fire", "CheckScheduleUpdate")
    m.scheduleCheckTimer.control = "RUN"
End Sub

'-------------------------------------------------------------------------------
' LoadNextProgram — Fetch the next program after the current one
'-------------------------------------------------------------------------------
Sub LoadNextProgram(currentEntry As Object)
    ' Get today's full schedule
    http = CreateObject("roUrlTransfer")
    today = FormatDt(CreateObject("roDateTime"), "%Y-%m-%d")
    http.SetUrl(m.apiBaseUrl + "/api/schedule?action=list&date=" + today)
    http.AddHeader("Accept", "application/json")

    jsonText = http.GetToString()

    If jsonText <> "" Then
        Try
            data = JsonDecode(jsonText)

            If data.entries <> Invalid Then
                ' Find the next program after current
                Dim currentId As String = currentEntry.contentId || ""
                Dim found As Boolean = False

                For Each entry In data.entries
                    If found And entry.scheduleId <> currentEntry.scheduleId Then
                        ' This is the next program — update the label
                        m.nextUpLabel.text = "UP NEXT: " + (entry.title || entry.contentId || "Unknown")
                        ' Store next program for auto-queue
                        m.nextProgram = entry
                        Return
                    End If

                    If entry.scheduleId = currentEntry.scheduleId Then
                        found = True
                    End If
                Next

                ' No next program found — show placeholder
                m.nextUpLabel.text = "UP NEXT: (end of today's schedule)"
            End If
        Catch e As Object
            Print "[LiveTV] Error loading next program: " + e.ToString()
        End Try
    End If
End Sub

'-------------------------------------------------------------------------------
' OnVideoState — React to video player state changes
'-------------------------------------------------------------------------------
Sub OnVideoState()
    ' States: "none", "idle", "play", "paused", "stopped", "error"
    Dim state As String = m.videoPlayer.state

    If state = "stopped" Or state = "idle" Then
        ' Program finished — play the next one in the schedule
        If m.nextProgram <> Invalid Then
            Print "[LiveTV] Current program ended. Loading next..."
            StartPlaying(m.nextProgram)
        Else
            ' No next program — show a "channel is closed" type message
            m.loadingPanel.visible = true
            m.loadingText.text = "Channel Closed — Check back tomorrow"
        End If
    ElseIf state = "error" Then
        Print "[LiveTV] Video error — retrying..."
        ' Attempt to restart the current program
        If m.currentProgram <> Invalid Then
            StartPlaying(m.currentProgram)
        End If
    End If
End Sub

'-------------------------------------------------------------------------------
' OnVideoStatus — React to video status events
'-------------------------------------------------------------------------------
Sub OnVideoStatus(status As Object)
    ' Status codes: 0=loaded, 1=buffering, 2=playing, 3=paused, 4=error, 5=ended
    ' Use these for analytics or progress tracking
End Sub

'-------------------------------------------------------------------------------
' CheckScheduleUpdate — Periodically re-check the schedule for live events
'-------------------------------------------------------------------------------
Sub CheckScheduleUpdate()
    ' This fires every 30 seconds
    ' Re-check if the schedule has changed (e.g., a live event started)
    m.clockTimer.control = "RUN"
End Sub

'-------------------------------------------------------------------------------
' UpdateClock — Show current time in the corner of the screen
'-------------------------------------------------------------------------------
Sub UpdateClock()
    Dim dt As Object = CreateObject("roDateTime")
    m.clockLabel.text = FormatDt(dt, "%I:%M %p")
    m.clockTimer.control = "RUN"
End Sub
