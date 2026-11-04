'===============================================================================
' Utilities.brs
' Hyperlocal Roku Channel - Utility functions for Cloudflare integration.
'
' This script handles:
'   1. API communication with Cloudflare Worker
'   2. Content catalog parsing (Roku format)
'   3. Search functionality
'   4. Hyperlocal filtering (category, location, date)
'   5. Common helpers (formatting, ID generation)
'
' Usage in any component:
'   <script type="text/brightscript" uri="pkg:/components/utils/Utilities.brs" />
'
' Then call:
'   LoadFromWorker(m.apiBaseUrl, "contentKey")
'   SearchWorker(m.apiBaseUrl, "search query")
'===============================================================================

' Global API base (set from your MainScene)
m.apiBaseUrl = ""

' ============================================================================
' API Communication Functions
' ============================================================================

'-------------------------------------------------------------------------------
' LoadFromWorker — Fetch catalog data from Cloudflare Worker
'
' Parameters:
'   baseUrl   — Your Cloudflare Worker URL (e.g., https://my-channel.worker.dev)
'   apiPath   — API endpoint (default: "/api/catalog")
'
' Returns:
'   roAssociativeAA with "content" array, or Invalid on failure
'-------------------------------------------------------------------------------
Function LoadFromWorker(baseUrl As String, apiPath As String = "/api/catalog") As Object
    m.apiBaseUrl = baseUrl

    http = CreateObject("roUrlTransfer")
    http.SetUrl(baseUrl + apiPath)
    http.AddHeader("Accept", "application/json")

    ' Optional: add an API key if you use Worker auth
    ' http.AddHeader("Authorization", "Bearer your-token-here")

    ' Fetch the catalog
    jsonText = http.GetToString()

    If jsonText = "" Or jsonText = Invalid Then
        Print "[Utils] Failed to fetch catalog from " + baseUrl + apiPath
        Return Invalid
    End If

    Return ParseJson(jsonText)
End Function

'-------------------------------------------------------------------------------
' SearchWorker — Search content on the Cloudflare Worker
'
' Parameters:
'   query     — Search string
'
' Returns:
'   roAssociativeAA with "results" array, or Invalid on failure
'-------------------------------------------------------------------------------
Function SearchWorker(query As String) As Object
    If m.apiBaseUrl = "" Then
        Print "[Utils] API base URL not set"
        Return Invalid
    End If

    http = CreateObject("roUrlTransfer")
    encodedQuery = Encode(query)
    http.SetUrl(m.apiBaseUrl + "/api/search?q=" + encodedQuery)
    http.AddHeader("Accept", "application/json")

    jsonText = http.GetToString()

    If jsonText = "" Or jsonText = Invalid Then
        Print "[Utils] Search failed"
        Return Invalid
    End If

    Return ParseJson(jsonText)
End Function

'-------------------------------------------------------------------------------
' GetCategories — Fetch available categories from Worker
'-------------------------------------------------------------------------------
Function GetCategories() As Object
    Return LoadFromWorker(m.apiBaseUrl, "/api/categories")
End Function

'-------------------------------------------------------------------------------
' GetLocations — Fetch hyperlocal locations (neighborhoods, districts)
'-------------------------------------------------------------------------------
Function GetLocations() As Object
    Return LoadFromWorker(m.apiBaseUrl, "/api/locations")
End Function

'-------------------------------------------------------------------------------
' GetTrending — Fetch most recently added content
'-------------------------------------------------------------------------------
Function GetTrending() As Object
    Return LoadFromWorker(m.apiBaseUrl, "/api/trending")
End Function

'-------------------------------------------------------------------------------
' GetByCategory — Filter content by category
'-------------------------------------------------------------------------------
Function GetByCategory(category As String) As Object
    If category = "" Then Return Invalid
    Return LoadFromWorker(m.apiBaseUrl, "/api/feed/category/" + Encode(category))
End Function

'-------------------------------------------------------------------------------
' GetByLocation — Filter content by location (hyperlocal!)
'-------------------------------------------------------------------------------
Function GetByLocation(location As String) As Object
    If location = "" Then Return Invalid
    Return LoadFromWorker(m.apiBaseUrl, "/api/feed/location/" + Encode(location))
End Function

' ------------------------------------------------------------------------------
' GetLatest — Fetch latest N items
' ------------------------------------------------------------------------------
Function GetLatest(limit As Integer = 10) As Object
    If limit < 1 Then limit = 10
    If limit > 100 Then limit = 100  ' Cap at 100
    Return LoadFromWorker(m.apiBaseUrl, "/api/feed/latest?limit=" + Str(limit))
End Function

' ============================================================================
' Parsing & Data Functions
' ============================================================================

'-------------------------------------------------------------------------------
' ParseJson — Parse a JSON string into an roAssociativeArray or roArray
'
' Uses Roku's built-in JsonDecode (SDK 6.0+). For older SDKs, use a parser.
'-------------------------------------------------------------------------------
Function ParseJson(text As String) As Object
    Try
        Return JsonDecode(text)
    Catch e As Object
        Print "[Utils] JSON Parse Error: " + e.ToString()
        Return Invalid
    End Try
End Function

'-------------------------------------------------------------------------------
' BuildRokuContentNode — Build a single ContentNode (roArray with roAA)
'
' This is the standard Roku format: roArray containing one roAssociativeAA
'-------------------------------------------------------------------------------
Function BuildRokuContentNode(data As Object) As Object
    node = CreateObject("roArray", 1, true)
    dict = CreateObject("roAssociativeAA")

    dict.id = data.id
    dict.title = data.title
    dict.description = data.description
    dict.posterUrl = data.posterUrl
    dict.streamUrl = data.streamUrl
    dict.streamFormat = data.streamFormat
    dict.contentType = data.contentType

    If data.length <> Invalid Then
        dict.length = data.length
    End If

    If data.isLive <> Invalid Then
        dict.isLive = data.isLive
    End If

    If data.isNew <> Invalid Then
        dict.isNew = data.isNew
    End If

    If data.keywords <> Invalid Then
        dict.keywords = data.keywords
    End If

    If data.category <> Invalid Then
        dict.category = data.category
    End If

    If data.location <> Invalid Then
        dict.location = data.location
    End If

    node[0] = dict
    Return node
End Function

' ============================================================================
' Video Player Functions
' ============================================================================

'-------------------------------------------------------------------------------
' PlayVideoFromStream — Start playback of a video
'
' Parameters:
'   streamUrl — HLS or MP4 URL from Cloudflare Stream
'   title     — Display title
'-------------------------------------------------------------------------------
Sub PlayVideoFromStream(streamUrl As String, title As String)
    If streamUrl = "" Then
        Print "[Utils] No stream URL"
        Return
    End If

    videoPlayer = CreateObject("roVideoPlayer")
    videoPlayer.observeField("state", "OnVideoState")

    playlist = CreateObject("roArray", 1, true)
    media = CreateObject("roAssociativeAA")
    media.url = streamUrl
    media.streamFormat = "hls"
    media.title = title

    playlist[0] = media
    videoPlayer.content = playlist
    videoPlayer.Show()
End Sub

' ============================================================================
' Common Helper Functions
' ============================================================================

'-------------------------------------------------------------------------------
' FormatDuration — Convert seconds to "H:MM:SS" or "MM:SS"
'-------------------------------------------------------------------------------
Function FormatDuration(seconds As Integer) As String
    hours = seconds / 3600
    remaining = seconds Mod 3600
    mins = remaining / 60
    secs = remaining Mod 60

    If hours > 0 Then
        Return StrF("%02d:%02d:%02d", hours, mins, secs)
    Else
        Return StrF("%02d:%02d", mins, secs)
    End If
End Function

'-------------------------------------------------------------------------------
' FormatDate — Format a date string for display
'-------------------------------------------------------------------------------
Function FormatDate(dateString As String) As String
    ' Expected format: "YYYY-MM-DD"
    ' Output: "Nov 5, 2025" or similar
    Try
        dt = CreateObject("roDateTime")
        dt.FromISO8601String(dateString + "T00:00:00Z")
        Return FormatDt(dt, "%b %d, %Y")
    Catch e As Object
        Return dateString
    End Try
End Function

'-------------------------------------------------------------------------------
' GenerateId — Create a unique ID for new content
'-------------------------------------------------------------------------------
Function GenerateId() As String
    dt = CreateObject("roDateTime")
    Return Str(dt.TotalSeconds())
End Function

'-------------------------------------------------------------------------------
' Encode — URL-encode a string
'-------------------------------------------------------------------------------
Function Encode(text As String) As String
    ' Roku has a built-in Encode function in newer SDKs
    ' For older SDKs, you'd implement percent-encoding manually
    Return Encode(text)  ' Built-in Roku function
End Function
