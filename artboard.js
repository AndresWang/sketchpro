@import 'common.js'

function newArtboard(context) {
    var doc = context.document
    var page = doc.currentPage()
    var artboards = page.artboards()
    var selection = context.selection
    var selectedArtboard = nil
    var menu = ["iPhone SE", "Selected Artboard"]

    if (selection.length == 0) {
        menu.splice(-1,1)
    } else {
        selectedArtboard = selection[0].parentArtboard()
    }
    
    // Window with drop down menu
    var option = createDropdown("New Artboard Size", menu, 0)
    if (option.responseCode == 1001) {return}
    
    
    // Define new size
    var newName
    var newWidth
    var newHeight
    switch (option.index) {
        case 0:
            newName = "iPhone SE"
            newWidth = 320
            newHeight = 568
            break
        default:
            newName = "Selected Artboard"
            newWidth = selectedArtboard.frame().width()
            newHeight = selectedArtboard.frame().height()
            break
    }
    
    // Define new position
    var newX = 0
    var newY = 0
    if (selectedArtboard) {
        // Move right side artboards
        for (var i = 0; i < artboards.count(); i++) {
            if (artboards[i].frame().y() >= selectedArtboard.frame().y() && artboards[i].frame().x() > selectedArtboard.frame().x()) {
                var newX = artboards[i].frame().x() + newWidth + 100
                artboards[i].frame().setX(newX)
            }
        }
        newX = selectedArtboard.frame().x() + selectedArtboard.frame().width() + 100
        newY = selectedArtboard.frame().y()
    } else {
        if (artboards.length > 0) {
            var rightMostArtboard = artboards.slice().sort(sortFromRight_Top)[0]
            newX = rightMostArtboard.frame().x() + rightMostArtboard.frame().width() + 100
            newY = rightMostArtboard.frame().y()
        }
    }
    
    // Add new artboard
    var config = {parent: page, name: newName, x: newX, y: newY, width: newWidth, height: newHeight}
    var insertIndex = page.indexOfLayer(selectedArtboard) + 1
    var newArtboard = createArtboard(config, insertIndex)
    newArtboard.select_byExpandingSelection(true, false)
    sketchAction.centerSelection(doc)
}

function removeArtboards(context) {
    var doc = context.document
    var selection = context.selection
    
    if (selection.count() < 1) {showAlert("Fail to remove artboard", "You should select at least 1 artboard");return}
    for (var j = 0; j < selection.count(); j++) {
        if (selection[j].class() != MSArtboardGroup) {showAlert("Fail to remove artboard", "You can only select artboards");return}
    }
    
    // Start to remove artboards
    doc.currentPage().changeSelectionBySelectingLayers(nil)
    for (var i = 0; i < selection.count(); i++) {
        var artboard = selection[i]
        removeArtboard(doc, artboard)
    }
    doc.showMessage("Artboards removed")
}

function convertToElement(context) {
    var doc = context.document
    var page = doc.currentPage()
    if (context.selection.length != 1) {showAlert("Fail to convert to element", "You should select 1 layer or group of the artboard");return}
    var selectedLayer = context.selection[0]
    var screen = selectedLayer.parentArtboard()
    if (selectedLayer == screen) {showAlert("Fail to convert to element", "You should select 1 layer or group of the artboard");return}
    
    // Move screen's current elements
    var artboards = doc.currentPage().artboards()
    var predicate = NSPredicate.predicateWithFormat("frame.x == %@ && frame.y > %@", screen.frame().x(), screen.frame().y())
    var currentElements = artboards.filteredArrayUsingPredicate(predicate)
    var newElementHeight = selectedLayer.frame().height()
    for (var i = 0; i < currentElements.count(); i++) {
        var newY = currentElements[i].frame().y() + newElementHeight + 50
        currentElements[i].frame().setY(newY)
    }
    
    // Duplicate selectedLayer & remove duplicate layer from screen
    sketchAction.duplicate(doc)
    var copyLayer = doc.selectedLayers().firstLayer()
    copyLayer.setName(selectedLayer.name())
    copyLayer.frame().setX(0) ; copyLayer.frame().setY(0)
    copyLayer.removeFromParent()
    
    // Create element artboard
    var config = {parent: page, name: screen.name() + "_", x: screen.frame().x(), y: screen.frame().y() + screen.frame().height() + 50, width: copyLayer.frame().width(), height: copyLayer.frame().height()}
    var insertIndex = page.indexOfLayer(screen) + 1
    var elementArtboard = createArtboard(config, insertIndex)
    
    // Add duplicate layer to elementArtboard & ungroup if needed
    elementArtboard.addLayers([copyLayer])
    if (copyLayer.class() == MSLayerGroup) {copyLayer.ungroup()}

    elementArtboard.select_byExpandingSelection(true, false)
    doc.showMessage("Element converted")
}

// MARK: Helper Methods
function removeArtboard(doc, artboard) {
    var width = artboard.frame().width()
    var artboards = doc.currentPage().artboards()
    
    for (var i = 0; i < artboards.count(); i++) {
        if (artboards[i].frame().x() == artboard.frame().x()) {
            artboards[i].select_byExpandingSelection(true, false)
            sketchAction.deleteAction(doc)
        } else if (artboards[i].frame().y() >= artboard.frame().y() && artboards[i].frame().x() > artboard.frame().x()) {
            var newX = artboards[i].frame().x() - width - 100
            artboards[i].frame().setX(newX)
        }
    }
}
