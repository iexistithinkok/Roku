# BrightScript Quick Reference for Roku

## Table of Contents
1. [Data Types](#data-types)
2. [Collections](#collections)
3. [Control Structures](#control-structures)
4. [Functions](#functions)
5. [SceneGraph Nodes](#scenegraph-nodes)
6. [Networking](#networking)
7. [DateTime](#datetime)
8. [Common Gotchas](#common-gotchas)

---

## Data Types

| Type | Description | Example |
|------|-------------|---------|
| `String` | Text (UTF-8) | `"Hello World"` |
| `Integer` | 32-bit signed int | `42`, `-7` |
| `Float` | 32-bit float | `3.14`, `-0.5` |
| `Boolean` | True/false | `True`, `False` |
| `Object` | Dynamic / untyped | `roArray`, `roAssociativeAA` |

> **Note:** BrightScript is statically typed. You declare types with `As TypeName`. Use `Object` when the type is unknown or dynamic.

### Type Conversion

```brightscript
s As String = Str(42)           ' Integer → String
n As Integer = Val("123")       ' String → Integer
f As Float = Val("3.14")        ' String → Float
b As Boolean = CBool(1)         ' Integer → Boolean
```

---

## Collections

### roArray (Arrays)

```brightscript
' Create a resizable array with capacity 10
arr = CreateObject("roArray", 10, true)

' Append items
arr.Append("item1")
arr.Append("item2")

' Access by index
first = arr[0]
last = arr.Count() - 1  ' Use .Count(), not .Length

' Loop through array
For Each item In arr
    Print item
Next
```

### roAssociativeArray (Dictionaries / Maps)

```brightscript
' Create an AA
dict = CreateObject("roAssociativeAA")

' Set values
dict.name = "John"
dict.age = 30
dict["email"] = "john@example.com"

' Read values
Print dict.name        ' Output: John
Print dict["age"]      ' Output: 30

' Check if key exists
If dict.HasKey("name") Then Print dict.name

' Get all keys
keys = dict.Keys()

' Get all values
values = dict.Values()

' Delete a key
dict.Delete("email")
```

---

## Control Structures

### If / Else

```brightscript
If condition Then
    ' ...
ElseIf otherCondition Then
    ' ...
Else
    ' ...
End If
```

### Select / Case

```brightscript
Select Case value
    Case 1
        Print "One"
    Case 2
        Print "Two"
    Case 3
        Print "Three"
    Case Else
        Print "Unknown"
End Select
```

### For Loop

```brightscript
' Counting loop
For i = 0 To 9
    Print i
Next

' Loop with step
For i = 0 To 100 Step 10
    Print i
Next

' For Each
For Each item In myArray
    Print item
Next
```

### While Loop

```brightscript
i = 0
While i < 10
    Print i
    i = i + 1
End While
```

### Try / Catch

```brightscript
Try
    riskyCall()
Catch e As Object
    Print "Caught: "; e.ToString()
Finally
    cleanup()
End Try
```

---

## Functions

### Sub (no return value)

```brightscript
Sub Greet(name As String)
    Print "Hello, " + name
End Sub
```

### Function (with return value)

```brightscript
Function Add(a As Integer, b As Integer) As Integer
    Return a + b
End Function
```

### Lambda-style (inline function)

```brightscript
callback = Sub(x As Integer) As Integer
    Return x * 2
End Sub
```

### Default Parameters (SDK 8+)

```brightscript
Sub Config(name As String, verbose As Boolean = False)
    ' ...
End Sub
```

---

## SceneGraph Nodes

### Creating Nodes

```brightscript
' Create a node by component name
panel = CreateObject("roSGNode", "Panel")

' Create a node with a custom component
myComponent = CreateObject("roSGNode", "MyComponent")
```

### Accessing Nodes in XML

```xml
<!-- In your .xml file -->
<Panel id="myPanel">
    <Label id="myLabel" text="Hello" />
</Panel>
```

```brightscript
' In .brs file (must call findNode AFTER Init)
m.myPanel = m.top.findNode("myPanel")
m.myLabel = m.myPanel.findNode("myLabel")
```

### Common Node Types

| Node | Purpose |
|------|---------|
| `Scene` | Root UI component (one per app) |
| `Panel` | Container, background |
| `Group` | Layout container |
| `LayoutGroup` | Flexbox-like layout |
| `Label` | Text display |
| `Text` | Editable text (input) |
| `Poster` | Image display |
| `Button` | Clickable button |
| `RecyclerView` | Scrollable list |
| `RowList` | Grid catalog (most common for content) |
| `ContentNode` | Metadata for an item |
| `Task` | Background task/thread |
| `Timer` | Periodic callback |

### ContentNode (for RowList, NodeFactory, etc.)

```brightscript
' ContentNode is ALWAYS an roArray with one roAssociativeAA element
contentNode = CreateObject("roArray", 1, true)
dict = CreateObject("roAssociativeAA")

dict.id = 1
dict.title = "Movie Title"
dict.description = "A great movie"
dict.streamUrl = "https://example.com/video.mp4"
dict.streamFormat = "mp4"
dict.contentType = "video"
dict.posterUrl = "https://example.com/poster.jpg"
dict.length = 7200  ' Duration in seconds

contentNode[0] = dict
```

### Observing Fields

```brightscript
' Observe a field change
m.button.observeField("selected", "OnButtonSelected")

' Remove observation
m.button.unobserveField("selected")

' Callback must be a method in the same component
Sub OnButtonSelected()
    Print "Button was selected!"
End Sub
```

### Setting Node Properties

```brightscript
' Set properties
node.text = "Hello World"
node.visible = True
node.translation = [100, 200]
node.scale = [1.5, 1.5]
node.opacity = 255  ' 0-255

' Get properties
Print node.text
Print node.visible
```

---

## Networking

### roUrlTransfer (HTTP)

```brightscript
' GET request
url = CreateObject("roUrlTransfer")
url.SetUrl("https://api.example.com/data")
url.AddHeader("Authorization", "Bearer token123")
response = url.GetToString()
data = ParseJson(response)

' POST request
postUrl = CreateObject("roUrlTransfer")
postUrl.SetUrl("https://api.example.com/submit")
postUrl.AddHeader("Content-Type", "application/json")

body = CreateObject("roAssociativeAA")
body.username = "user"
body.password = "pass"

jsonBody = JsonEncode(body)
response = postUrl.PostFromString(jsonBody)
result = ParseJson(response)

' Check for HTTP errors
code = url.GetStatusCode()
If code <> 200 Then
    Print "HTTP Error: " + Str(code)
End If
```

### roUrlEvent (Streaming video/audio)

```brightscript
player = CreateObject("roUrlEvent")
player.SetUrl("https://example.com/stream.mp4")
player.Mode(6)  ' 6 = streaming mode
player.GetMessagePort()
```

---

## DateTime

```brightscript
' Current time
dt = CreateObject("roDateTime")

' Set specific date/time
dt.FromISO8601String("2025-01-15T12:00:00Z")

' Get time in various formats
seconds = dt.TotalSeconds()          ' Unix timestamp (seconds since 1970)
milliseconds = dt.TotalMilliseconds()  ' Unix timestamp (milliseconds)

' Local time components
localSec = dt.GetTotalSeconds()

' Format date string
formatted = FormatDt(dt, "%Y-%m-%d %H:%M:%S")
```

---

## Common Gotchas

1. **ContentNode is `roArray` with one element** — Always wrap your dictionary in `roArray(1, true)` and put the dict at index `[0]`.

2. **Array length is `.Count()`** — Not `.Length` or `.Length()`. Use `myArray.Count()`.

3. **Node properties in XML** — Properties like `text`, `uri`, `id` must be in the XML. You can't do `node.text = ...` for all properties in early SDK versions.

4. **Focus management** — Only one node can have focus at a time. Use `node.setFocus(true)` explicitly.

5. **No global variables** — Each component (scene) has its own scope. Use `m.` prefix for member variables.

6. **No exception throwing** — Use Try/Catch and check return values (often `Invalid` means failure).

7. **`Wait()` returns messages** — For GUI apps, `msg = Wait(0, port)` blocks until a message arrives.

8. **`roArray` vs `roAssociativeAA`** — Arrays are indexed by numbers; AssociativeArrays by string keys.

9. **Strings are immutable** — You cannot modify a string in place. Use `+` for concatenation.

10. **SDK version matters** — Some features (like `JsonEncode`/`JsonDecode`, default parameters) require SDK 6.0+.

---

## Common File Extensions

| Extension | Purpose |
|-----------|---------|
| `.brs`    | BrightScript source code |
| `.xml`    | SceneGraph component definition (paired with `.brs`) |
| `manifest` | App metadata (no extension) |
| `.png`    | Images (icons, posters, thumbnails) |
| `.xml` (in `resources/en_us/`) | Localized strings |

---

## Minimal Component Structure

Every SceneGraph component has TWO files:

```
MyComponent.xml          ← Defines the UI layout (nodes, children, fields)
MyComponent.brs          ← Defines the behavior (event handlers, logic)
```

```xml
<!-- MyComponent.xml -->
<component name="MyComponent" extends="Group">
    <script type="text/brightscript" uri="MyComponent.brs" />
    <children>
        <Label id="myLabel" text="Default Text" />
    </children>
</component>
```

```brightscript
' MyComponent.brs
Sub Init()
    m.myLabel = m.top.findNode("myLabel")
    m.myLabel.text = "Updated Text"
End Sub
```
