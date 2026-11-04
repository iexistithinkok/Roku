'===============================================================================
' ContentCard.brs
' Logic for a reusable card component showing poster + title + description.
'===============================================================================

Sub Init()
    m.posterImage = m.top.findNode("posterImage")
    m.titleLabel  = m.top.findNode("titleLabel")
    m.descLabel   = m.top.findNode("descLabel")

    ' Listen for focus events so parent can react
    m.titleLabel.observeField("focused", "OnFocused")
    m.titleLabel.observeField("unfocused", "OnUnfocused")
End Sub

'-------------------------------------------------------------------------------
' SetPoster - Set the poster image URL
'-------------------------------------------------------------------------------
Sub SetPoster(url As String)
    If m.posterImage <> Invalid Then
        m.posterImage.uri = url
    End If
End Sub

'-------------------------------------------------------------------------------
' SetTitle - Set the card title
'-------------------------------------------------------------------------------
Sub SetTitle(text As String)
    If m.titleLabel <> Invalid Then
        m.titleLabel.text = text
    End If
End Sub

'-------------------------------------------------------------------------------
' SetDescription - Set the card description
'-------------------------------------------------------------------------------
Sub SetDescription(text As String)
    If m.descLabel <> Invalid Then
        m.descLabel.text = text
    End If
End Sub

'-------------------------------------------------------------------------------
' OnFocused - Called when this card receives focus
'-------------------------------------------------------------------------------
Sub OnFocused()
    If m.posterImage <> Invalid Then
        ' Add a visual effect (e.g., scale up slightly)
        m.posterImage.scale = [1.05, 1.05]
        m.posterImage.translation = [-7.5, -11]
    End If
End Sub

'-------------------------------------------------------------------------------
' OnUnfocused - Called when focus leaves this card
'-------------------------------------------------------------------------------
Sub OnUnfocused()
    If m.posterImage <> Invalid Then
        m.posterImage.scale = [1.0, 1.0]
        m.posterImage.translation = [0, 0]
    End If
End Sub
