function PostsController() {
    var gists = new Backbone.GistsCollection();
    gists.fetch({
        success: function() {
            var posts = new Backbone.GistsCollection(gists.filter(function (gist) {
                return gist.get('description').indexOf('@post') !== -1;
            }));
            var main = new Backbone.Layout({
                template: _.template('<section id="content"></section>'),

                views: {
                    "#content": new Backbone.PostsListView({
                        collection: posts
                    })
                }
            });
            main.$el.appendTo("#container");
            main.render();
        }
    });
}