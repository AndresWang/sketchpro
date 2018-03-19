@import 'common.js'

function lock(context) {
    var doc = context.document
    var selection = context.selection
    
    if (selection.count() > 0) {
        for (var i = 0; i < selection.count(); i++) {
            var layer = selection[i]
            var children = layer.children()
            for (var j = 0; j < children.count(); j++) {
                children[j].setIsLocked(true)
            }
        }
        doc.showMessage("Selected range of layers locked")
    } else {
        var page = doc.currentPage()
        var children = page.children()
        for (var i = 0; i < children.count(); i++) {
            children[i].setIsLocked(true)
        }
        doc.showMessage("All layers of current page locked")
    }
}

function unlock(context) {
    var doc = context.document
    var selection = context.selection
    
    if (selection.count() > 0) {
        for (var i = 0; i < selection.count(); i++) {
            var layer = selection[i]
            var children = layer.children()
            for (var j = 0; j < children.count(); j++) {
                children[j].setIsLocked(false)
            }
        }
        doc.showMessage("Selected range of layers unlocked")
    } else {
        var page = doc.currentPage()
        var children = page.children()
        for (var i = 0; i < children.count(); i++) {
            children[i].setIsLocked(false)
        }
        doc.showMessage("All layers of current page unlocked")
    }
}
