<template>
  <div class="tab-about mb-2c">
    <h1 class="mt-0 mr-1c">
      <span v-text="name"></span>
      <small v-text="`v${version}`"></small>
    </h1>
    <p v-text="i18n('extDescription')"></p>
    <div>
      <label v-text="i18n('labelRelated')"></label>
      <ul>
        <li><a href="https://github.com/acestream/webextension" target="_blank">Source code</a></li>
        <li><a href="https://acestream.org/about/privacy-policy" target="_blank">Privacy policy</a></li>
      </ul>
    </div>
    <div>
      <label v-text="i18n('labelCurrentLang')"></label>
      <span class="current" v-text="language"></span> |
      <a href="https://violentmonkey.github.io/localization/" target="_blank" rel="noopener noreferrer" v-text="i18n('labelHelpTranslate')"></a>
    </div>
  </div>
</template>

<script>
import { focusMe } from '@/common/ui';

export default {
  data() {
    return {
      name: extensionManifest.name,
      version: process.env.VM_VER,
      language: browser.i18n.getUILanguage(),
    };
  },
  activated() {
    focusMe(this.$el);
  },
};
</script>

<style>
  .current {
    color: green;
    @media (prefers-color-scheme: dark) {
      color: greenyellow;
    }
  }
</style>
