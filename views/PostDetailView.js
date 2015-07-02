Backbone.PostDetailView = Backbone.Layout.extend({
    template: 'PostDetailTemplate.html',
    serialize: function()
    {
        return {
            post: this.model
        }
    }
});
