$(function(){
    var Router = Backbone.Router.extend({
        routes: {
            '': 'profileController',
            '/': 'profileController',
            'posts': 'postsController'
        },

        profileController: function()
        {
            var main = new Backbone.Layout({
                template: _.template('<section id="content"></section>'),

                views: {
                    "#content": new Backbone.ProfileView()
                }
            });
            $('body').html(main.$el);
            main.render();
        },

        postsController: function()
        {
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
                    $('body').html(main.$el);
                    main.render();
                }
            });
        }
    });
    new Router();
    Backbone.history.start({pushState: true})
});