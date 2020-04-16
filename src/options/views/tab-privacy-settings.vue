<template>
  <div class="tab-privacy-settings" v-show="ready">
    <h1 v-text="i18n('Privacy Settings')"></h1>

    <div v-show="optInConfirmed">
      <input id="optInAccepted" type="checkbox" :checked="optInAccepted" @change="onChange">
      <label for="optInAccepted">Allow anonymous processing of your IP address</label>
    </div>

    <div v-show="!optInConfirmed">
      <div>
        <p>
          This extension does not collect any of your personal data.
        </p>

        <p>
          However, it will periodically send requests to our server to update
          userscript recommendations. This request contains such anonymous data:
          <ul>
            <li>vendor of the browser you use</li>
            <li>your preferred language</li>
            <li>the version of the extension</li>
          </ul>
        </p>

        <p>
          Technically each request contains your IP address, which may
          be treated as personal data. We don't collect and process this data in
          any way, but to be compliant with the browser's privacy policy we need
          your explicit permission to collect IP address if we need it in the
          future.
        </p>

        <p>
          So, if you grant us a permission to process your IP address (without
          ever sharing it with third parties) then click "Accept" below. Otherwise,
          click "Reject" (you can change your opinion any time later):
        </p>

        <p>
          <button v-text="i18n('Accept')" @click="acceptOptIn"></button>
          <button v-text="i18n('Reject')" @click="rejectOptIn" autofocus="true"></button>
        </p>

        <hr/>

        <p>
          You can find more info here:
          <a target="_blank" href="https://addons.mozilla.org/en-US/firefox/addon/ace-script/privacy/">
            Privacy policy
          </a>
        </p>
      </div>

    </div>

  </div>
</template>

<script>
import { getPrivacyOptions, setPrivacyOptions } from '#/common/privacy';

const data = {
  ready: false,
  optInConfirmed: false,
  optInAccepted: false,
};

getPrivacyOptions().then(result => {
  data.optInConfirmed = result.confirmed;
  data.optInAccepted = result.accepted;
  data.ready = true;
});

function confirm(accepted) {
  data.optInConfirmed = true;
  data.optInAccepted = accepted;
  setPrivacyOptions(accepted);
}

export default {
  data() {
    return data;
  },
  methods: {
    acceptOptIn() {
      confirm(true);
    },
    rejectOptIn() {
      confirm(false);
    },
    onChange(event) {
      confirm(event.target.checked);
    },
  },
};
</script>
