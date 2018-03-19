@import 'common.js'

function spaceHorizontally(context) {
    var selection = context.selection

    if (selection.count() > 1) {
        var alert = createDialog("Space Horizontally", nil, "Spacing:", "100", nil, nil)
        var spacing = handleAlertResponse_Space(alert,alert.runModal()).spacing
        if (!spacing) {spacing = 0}

        var sortedLayers = selection.slice().sort(sortX_FromLeft)
        var nextX = sortedLayers[0].frame().x()

        for (var i = 0; i < sortedLayers.length; i++) {
            var myFrame = sortedLayers[i].frame()
            myFrame.setX(nextX)
            nextX += (myFrame.width() + spacing)
        }
    } else {
        showAlert("Fail to space layers", "You should select at least 1 layer")
    }
}
function spaceVertically(context) {
    var selection = context.selection

    if (selection.count() > 1) {
        var alert = createDialog("Space Vertically", nil, "Spacing:", "0", nil, nil)
        var spacing = handleAlertResponse_Space(alert,alert.runModal()).spacing
        if (!spacing) {spacing = 0}

        var sortedLayers = selection.slice().sort(sortY_FromTop)
        var nextY = sortedLayers[0].frame().y()

        for (var i = 0; i < sortedLayers.length; i++) {
            var myFrame = sortedLayers[i].frame()
            myFrame.setY(nextY)
            nextY += (myFrame.height() + spacing)
        }
    } else {
        showAlert("Fail to space layers", "You should select at least 1 layer")
    }
}


// MARK: - Helper Methods
function handleAlertResponse_Space(alert, responseCode) {
    if (responseCode == "1000") {
        return {spacing: numberAtIndex (alert, 1)}
    }
    return nil
}
