'===============================================================================
' MainScene.brs
' This is the BrightScript file for MainScene.
' Connects to a Cloudflare Worker API for hyperlocal content.
'
' Data flow:
'   Cloudflare Worker (/api/catalog) → Roku RowList UI
'   Cloudflare Worker (/api/search)  → Roku search capability
'   Cloudflare KV (metadata) + R2/Stream (videos)
'===============================================================================

Sub Init()
    ' Initialize the component when it is created
    m.top.functionName = "init"

    ' Find references to nodes defined in the XML
    m.titleLabel  = m.top.findNode("titleLabel")
    m.contentRowList = m.top.findNode("contentRowList")
    m.statusLabel = m.top.findNode("statusLabel")
    m.detailPoster = m.top.findNode("detailPoster")

    ' ====== CLOUDFLARE WORKER CONFIG ======
    ' Replace these with your actual Cloudflare Worker URL and KV namespace
    m.apiBaseUrl = "https://my-hyperlocal-channel.your-subdomain.workers.dev"
    ' m.apiBaseUrl = "http://localhost:8787"  ' For local Worker development

    ' Set up the content loading task
    LoadCatalog()

    ' Focus on the RowList
    m.contentRowList.focusable = true
    m.contentRowList.setFocus(true)

    ' Listen for user interactions
    m.contentRowList.observeField("itemSelected", "OnItemSelected")
    m.contentRowList.observeField("itemFocused", "OnItemFocused")
End Sub

'-------------------------------------------------------------------------------
' LoadCatalog — Fetch content from Cloudflare Worker API
'-------------------------------------------------------------------------------
Sub LoadCatalog()
    m.statusLabel.text = "Loading content..."

    ' Create an HTTP task to fetch the catalog asynchronously
    catalogTask = CreateObject("roTask")
    catalogTask.RunUrl = m.apiBaseUrl + "/api/catalog"
    catalogTask.Mode(6)  ' Non-blocking
    catalogTask.observeField("status", "OnCatalogLoaded")

    ' Fallback: if the API is unreachable, show a message
    ' In production, you'd want a proper timeout and retry logic
End Sub

'-------------------------------------------------------------------------------
' OnCatalogLoaded — Handle the catalog response from the Worker
'-------------------------------------------------------------------------------
Sub OnCatalogLoaded()
    task = m.cTask
    status = task.status

    If status <> Invalid Then
        ' Status is an roArray with statusCode and body
        statusCode = status[0]

        If statusCode = 200 Then
            ' Parse the catalog response
            responseBody = status[1]
            ParseCatalogResponse(responseBody)
        Else
            m.statusLabel.text = "Error loading content. Check connection."
        End If
    End If
End Sub

'-------------------------------------------------------------------------------
' ParseCatalogResponse — Parse JSON catalog from Worker into RowList format
'-------------------------------------------------------------------------------
Sub ParseCatalogResponse(jsonString As String)
    If jsonString = "" Or jsonString = Invalid Then
        m.statusLabel.text = "No content available"
        Return
    End If

    ' Parse the JSON response
    catalog = ParseJson(jsonString)
    If catalog = Invalid Then
        m.statusLabel.text = "Failed to parse content"
        Return
    End If

    ' Extract content array from catalog
    contentArray = catalog.catalog.content

    If contentArray = Invalid Or contentArray.Count() = 0 Then
        m.statusLabel.text = "No content available"
        Return
    End If

    ' Build the RowList content
    rowListContent = CreateObject("roArray", contentArray.Count(), true)

    For Each item In contentArray
        contentNode = CreateObject("roArray", 1, true)
        dict = CreateObject("roAssociativeAA")

        dict.id = item.id
        dict.title = item.title
        dict.description = item.description
        dict.posterUrl = item.posterUrl
        dict.streamUrl = item.streamUrl
        dict.streamFormat = item.streamFormat
        dict.contentType = item.contentType
        dict.length = item.length

        ' Custom fields for hyperlocal features
        dict.category = item.category
        dict.location = item.location
        dict.date = item.date
        dict.keywords = item.keywords

        If item.isLive = True Then
            dict.isLive = True
        End If

        If item.isNew = True Then
            dict.isNew = True
        End If

        contentNode[0] = dict
        rowListContent.Append(contentNode)
    Next

    ' Assign to RowList
    m.contentRowList.content = rowListContent
    m.contentRowList.rowSize = [800, 300]

    ' Update the title
    m.titleLabel.text = "My Hyperlocal Channel"
    m.statusLabel.text = "Showing " + Str(contentArray.Count()) + " items"
End Sub

'-------------------------------------------------------------------------------
' OnItemFocused — Called when user highlights a RowList item
'-------------------------------------------------------------------------------
Sub OnItemFocused(index As Integer, roo As Object)
    If roo <> Invalid And index >= 0 Then
        content = m.contentRowList.content
        meta = content[index][0]  ' ContentNode wraps its dict in [0]

        title = ""
        If meta.title <> Invalid Then title = meta.title

        location = ""
        If meta.location <> Invalid Then location = meta.location

        category = ""
        If meta.category <> Invalid Then category = meta.category

        ' Show hyperlocal info in the status label
        m.statusLabel.text = title

        If location <> "" Then
            m.statusLabel.text = m.statusLabel.text + " — " + location
        End If

        If category <> "" Then
            m.statusLabel.text = m.statusLabel.text + " (" + category + ")"
        End If
    End If
End Sub

'-------------------------------------------------------------------------------
' OnItemSelected — Called when user selects (OK) a RowList item
'-------------------------------------------------------------------------------
Sub OnItemSelected(index As Integer)
    If index >= 0 Then
        content = m.contentRowList.content
        meta = content[index][0]

        title = "No Title"
        If meta.title <> Invalid Then title = meta.title

        streamUrl = ""
        If meta.streamUrl <> Invalid Then streamUrl = meta.streamUrl

        ' Start playing the video
        PlayVideo(streamUrl, title)
    End If
End Sub

'-------------------------------------------------------------------------------
' PlayVideo — Start playback of a video from Cloudflare Stream
'-------------------------------------------------------------------------------
Sub PlayVideo(url As String, title As String)
    If url = "" Then
        m.statusLabel.text = "No video URL available"
        Return
    End If

    ' Create a video player component
    videoPlayer = CreateObject("roVideoPlayer")
    videoPlayer.observeField("state", "OnVideoStateChanged")
    videoPlayer.observeField("status", "OnVideoStatus")

    ' Create a playlist entry (media is an roArray with roAssociativeAA)
    playlist = CreateObject("roArray", 1, true)
    media = CreateObject("roAssociativeAA")

    media.url = url
    media.streamFormat = "hls"
    media.title = title

    ' Optional: poster/thumbnail for the player
    ' media.posterUrl = posterUrl

    ' Optional: metadata
    ' meta.description = description
    ' meta.seriesTitle = seriesTitle

    playlist[0] = media
    videoPlayer.content = playlist

    ' Show fullscreen player
    m.statusLabel.text = "Playing: " + title

    ' Use a Scene to show the video player
    ' (This is the simplest Roku video playback approach)
    screen = CreateObject("roVideoScreen")
    screen.SetContent(playlist[0])
    screen.Show()

    ' Show the player
    videoPlayer.Show()

    ' Wait for playback to finish
    Wait(0, videoPlayer.GetMessagePort())

    ' Clean up - go back to catalog
    videoPlayer.Close()
    m.statusLabel.text = "Return to catalog"
End Sub

'-------------------------------------------------------------------------------
' OnVideoStateChanged — React to video playback state changes
'-------------------------------------------------------------------------------
Sub OnVideoStateChanged()
    ' Possible states: "none", "idle", "play", "paused", "stopped", "error"
    ' This is where you'd add analytics, pause handling, etc.
End Sub

'-------------------------------------------------------------------------------
' OnVideoStatus — React to video status events
'-------------------------------------------------------------------------------
Sub OnVideoStatus(status As Object)
    ' Status codes:
    '   0 = loaded, 1 = buffering, 2 = playing, 3 = paused
    '   4 = error,  5 = ended
    ' Use these for error handling or tracking
End Sub
